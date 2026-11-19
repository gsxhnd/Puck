export type LocalFileEntry = {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modified?: number;
};

export type GitFileStatus = {
  path: string;
  indexStatus: string;
  worktreeStatus: string;
  /** Present for rename/copy entries. / rename 或 copy 记录的原始路径。 */
  origPath?: string;
};

export type GitStatusResult = {
  isRepo: boolean;
  branch?: string;
  upstream?: string;
  ahead?: number;
  behind?: number;
  staged: GitFileStatus[];
  unstaged: GitFileStatus[];
  untracked: string[];
};

export type GitCommitEntry = {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  subject: string;
};

export type GitBranchEntry = {
  name: string;
  shortHash: string;
  isCurrent: boolean;
};

/** Structured failure kind of a git network operation. / git 网络操作的结构化失败类别。 */
export type GitNetworkErrorKind = "auth" | "no_upstream" | "network";

export type GitNetworkResult = {
  ok: boolean;
  errorKind?: GitNetworkErrorKind;
  message?: string;
};
