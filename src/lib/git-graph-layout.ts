/**
 * Computes deterministic lanes and commit-to-parent edges for a Git graph.
 *
 * 为 Git 提交图计算确定性的 lane 与父子连接。输入按 Git log 的新到旧顺序排列；
 * 首个父提交优先沿用当前 lane，其余父提交复用已预留或空闲 lane。尚未加载的
 * 父提交仍保留 lane，对应连接的 parentRow 为 null，便于分页时绘制到列表底部。
 */
import type { GitGraphCommit } from "@/types/workspace";

export type GraphCommit = GitGraphCommit;

/** A commit positioned in the graph. / 提交在图中的位置。 */
export type GitGraphNode = {
  commit: GraphCommit;
  row: number;
  lane: number;
};

/**
 * A directed connection from a child commit to one of its parents.
 * parentRow is null when that parent is not present in the input page.
 *
 * 从子提交指向一个父提交的连接。父提交不在当前输入分页中时 parentRow 为 null；
 * parentLane 仍指向预留 lane，parentIndex 保留父提交在 merge 中的原始顺序。
 */
export type GitGraphEdge = {
  childHash: string;
  parentHash: string;
  childRow: number;
  childLane: number;
  parentRow: number | null;
  parentLane: number;
  parentIndex: number;
};

/** The complete graph layout. / 完整的提交图布局。 */
export type GitGraphLayout = {
  nodes: GitGraphNode[];
  edges: GitGraphEdge[];
  /** Maximum number of lanes visible at any row. / 任意一行可见的最大 lane 数。 */
  laneCount: number;
};

type PendingEdge = Omit<GitGraphEdge, "parentRow">;

function findLane(lanes: readonly (string | null)[], hash: string): number {
  for (let lane = 0; lane < lanes.length; lane += 1) {
    if (lanes[lane] === hash) return lane;
  }
  return -1;
}

function firstFreeLane(lanes: readonly (string | null)[]): number {
  for (let lane = 0; lane < lanes.length; lane += 1) {
    if (lanes[lane] === null) return lane;
  }
  return lanes.length;
}

function trimFreeLanes(lanes: (string | null)[]): void {
  while (lanes.length > 0 && lanes[lanes.length - 1] === null) {
    lanes.pop();
  }
}

function uniqueParents(commit: GraphCommit): string[] {
  const seen = new Set<string>();
  const parents: string[] = [];
  for (const parent of commit.parents) {
    if (seen.has(parent)) continue;
    seen.add(parent);
    parents.push(parent);
  }
  return parents;
}

/**
 * Lays out commits in their supplied newest-first order without mutating them.
 *
 * 按输入的新到旧顺序布局提交，不修改输入数据。每条 lane 最多预留一个待出现的
 * 提交；提交到达后释放其 lane，merge 的其他父提交和 fork 的共同父提交会复用
 * 已预留 lane，空闲 lane 则始终从最小索引开始复用，因此线性历史和 root 之后
 * 不会持续增加 lane。laneCount 记录历史峰值，而不是最后一行仍在使用的数量。
 */
export function layoutGitGraph(
  commits: readonly GraphCommit[],
): GitGraphLayout {
  // A non-null entry is the commit hash expected next in that lane.
  // 非空项表示该 lane 中下一个应出现的提交，同时保证同一 hash 只占一条 lane。
  const lanes: (string | null)[] = [];
  const nodes: GitGraphNode[] = [];
  const pendingEdges: PendingEdge[] = [];
  const nodesByHash = new Map<string, GitGraphNode>();
  let laneCount = 0;

  for (let row = 0; row < commits.length; row += 1) {
    const commit = commits[row];
    if (!commit) continue;

    let lane = findLane(lanes, commit.hash);
    if (lane === -1) lane = firstFreeLane(lanes);

    const node: GitGraphNode = { commit, row, lane };
    nodes.push(node);
    if (!nodesByHash.has(commit.hash)) nodesByHash.set(commit.hash, node);
    laneCount = Math.max(laneCount, lane + 1);

    // Consuming the commit releases its lane before reserving its parents.
    // 当前提交已经到达，先释放 lane，再为父提交预留，以便首个父提交直线继承。
    lanes[lane] = null;

    const parents = uniqueParents(commit);
    for (let parentIndex = 0; parentIndex < parents.length; parentIndex += 1) {
      const parentHash = parents[parentIndex];
      if (parentHash === undefined) continue;

      let parentLane = findLane(lanes, parentHash);
      if (parentLane === -1) {
        parentLane =
          parentIndex === 0 && lanes[lane] === null
            ? lane
            : firstFreeLane(lanes);
        lanes[parentLane] = parentHash;
      }

      laneCount = Math.max(laneCount, parentLane + 1);
      pendingEdges.push({
        childHash: commit.hash,
        parentHash,
        childRow: row,
        childLane: lane,
        parentLane,
        parentIndex,
      });
    }

    trimFreeLanes(lanes);
  }

  const edges = pendingEdges.map((edge): GitGraphEdge => {
    const parent = nodesByHash.get(edge.parentHash);
    return {
      ...edge,
      parentRow: parent?.row ?? null,
      parentLane: parent?.lane ?? edge.parentLane,
    };
  });

  return { nodes, edges, laneCount };
}
