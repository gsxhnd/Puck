/**
 * Paginated, read-only Git DAG graph with commit details.
 *
 * 分页只读 Git DAG 图：使用 SVG 绘制分支与合并连接，支持 ref、提交详情和
 * 按需加载历史。布局计算与 IPC 分离，避免在渲染期间执行 Git。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { GitCommitHorizontalIcon, RefreshCwIcon } from "lucide-react";
import { layoutGitGraph } from "@/lib/git-graph-layout";
import { gitGraph } from "@/lib/tauri-git";
import { parsePuckError } from "@/lib/puck-error";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Button } from "@/components/ui/button";
import type { GitGraphCommit } from "@/types/workspace";

const PAGE_SIZE = 200;
const ROW_HEIGHT = 32;
const LANE_WIDTH = 16;
const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

type GitGraphProps = {
  path: string;
  source: "local" | "remote";
  connectionId?: string;
};

export function GitGraph({ path, source, connectionId }: GitGraphProps) {
  const { t } = useTranslation("common");
  const remoteStatus = useWorkspaceStore((state) => state.remoteStatus);
  const [commits, setCommits] = useState<GitGraphCommit[]>([]);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async (reset: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const page = await gitGraph(path, PAGE_SIZE, reset ? 0 : commits.length, connectionId);
      setCommits((current) => {
        const combined = reset ? page : [...current, ...page];
        return Array.from(new Map(combined.map((commit) => [commit.hash, commit])).values());
      });
      setHasMore(page.length === PAGE_SIZE);
      if (reset) setSelectedHash(null);
    } catch (reason) {
      setError(parsePuckError(reason).message);
    } finally {
      setLoading(false);
    }
  }, [commits.length, connectionId, path]);

  useEffect(() => {
    setCommits([]);
    setHasMore(false);
    if (source === "local" || (connectionId && remoteStatus === "connected")) {
      void load(true);
    }
  }, [connectionId, path, remoteStatus, source]); // Initial load is intentionally scoped to the workspace.

  const layout = useMemo(() => layoutGitGraph(commits), [commits]);
  const graphWidth = Math.max(44, (layout.laneCount + 1) * LANE_WIDTH);
  const height = Math.max(ROW_HEIGHT, commits.length * ROW_HEIGHT);
  const selected = commits.find((commit) => commit.hash === selectedHash) ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border/60 px-3">
        <GitCommitHorizontalIcon className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">{t("workspace.graph")}</span>
        <span className="text-[10px] text-muted-foreground">{commits.length}</span>
        <Button
          variant="ghost"
          size="icon-xs"
          className="ml-auto"
          aria-label={t("actions.refresh")}
          disabled={loading}
          onClick={() => void load(true)}
        >
          <RefreshCwIcon className={cn(loading && "animate-spin")} />
        </Button>
      </div>

      {error ? <div className="border-b border-border/60 px-3 py-2 text-xs text-destructive">{error}</div> : null}

      <div className="min-h-0 flex-1 overflow-auto">
        {commits.length === 0 && !loading && !error ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            {t("workspace.graphEmpty")}
          </div>
        ) : (
          <div className="relative min-w-max" style={{ height }}>
            <svg
              className="pointer-events-none absolute inset-0"
              width={graphWidth}
              height={height}
              viewBox={`0 0 ${graphWidth} ${height}`}
            >
              {layout.edges.map((edge) => {
                const x1 = edge.childLane * LANE_WIDTH + 10;
                const y1 = edge.childRow * ROW_HEIGHT + ROW_HEIGHT / 2;
                const x2 = edge.parentLane * LANE_WIDTH + 10;
                const y2 = edge.parentRow === null
                  ? height
                  : edge.parentRow * ROW_HEIGHT + ROW_HEIGHT / 2;
                const middle = y1 + Math.max(8, (y2 - y1) / 2);
                return (
                  <path
                    key={`${edge.childHash}:${edge.parentHash}:${edge.parentIndex}`}
                    d={`M ${x1} ${y1} C ${x1} ${middle}, ${x2} ${middle}, ${x2} ${y2}`}
                    fill="none"
                    stroke={COLORS[edge.parentLane % COLORS.length]}
                    strokeWidth={1.5}
                    opacity={0.8}
                  />
                );
              })}
              {layout.nodes.map((node) => (
                <circle
                  key={node.commit.hash}
                  cx={node.lane * LANE_WIDTH + 10}
                  cy={node.row * ROW_HEIGHT + ROW_HEIGHT / 2}
                  r={node.commit.hash === selectedHash ? 4 : 3}
                  fill="var(--background)"
                  stroke={COLORS[node.lane % COLORS.length]}
                  strokeWidth={2}
                />
              ))}
            </svg>

            {layout.nodes.map((node) => {
              const commit = node.commit;
              const active = commit.hash === selectedHash;
              return (
                <button
                  key={commit.hash}
                  type="button"
                  className={cn(
                    "absolute left-0 flex h-8 w-full min-w-max items-center pr-4 text-left text-xs hover:bg-muted/40",
                    active && "bg-muted/60",
                  )}
                  style={{ top: node.row * ROW_HEIGHT, paddingLeft: graphWidth }}
                  onClick={() => setSelectedHash(active ? null : commit.hash)}
                >
                  <span className="w-16 shrink-0 font-mono text-muted-foreground">{commit.shortHash}</span>
                  <span className="flex min-w-0 items-center gap-1.5">
                    {commit.refs.slice(0, 3).map((ref) => (
                      <span key={ref} className="max-w-40 truncate rounded bg-muted px-1.5 py-0.5 text-[10px] text-foreground/80">
                        {ref}
                      </span>
                    ))}
                    <span className="max-w-[36rem] truncate" title={commit.subject}>{commit.subject}</span>
                  </span>
                  <span className="ml-4 max-w-32 truncate text-muted-foreground">{commit.author}</span>
                  <span className="ml-4 shrink-0 text-[10px] text-muted-foreground">
                    {new Date(commit.date).toLocaleDateString()}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {hasMore ? (
        <div className="flex h-9 shrink-0 items-center justify-center border-t border-border/60">
          <Button variant="ghost" size="xs" disabled={loading} onClick={() => void load(false)}>
            {loading ? t("workspace.graphLoading") : t("workspace.graphLoadMore")}
          </Button>
        </div>
      ) : null}

      {selected ? (
        <div className="grid shrink-0 grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-border/60 bg-shell-primary px-4 py-3 text-xs">
          <span className="text-muted-foreground">{t("workspace.graphCommit")}</span>
          <span className="font-mono break-all">{selected.hash}</span>
          <span className="text-muted-foreground">{t("workspace.graphAuthor")}</span>
          <span>{selected.author} · {selected.date}</span>
          <span className="text-muted-foreground">{t("workspace.graphParents")}</span>
          <span className="font-mono break-all">{selected.parents.join(" ") || "—"}</span>
        </div>
      ) : null}
    </div>
  );
}
