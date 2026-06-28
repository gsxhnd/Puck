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
};

export type GitStatusResult = {
  isRepo: boolean;
  branch?: string;
  staged: GitFileStatus[];
  unstaged: GitFileStatus[];
  untracked: string[];
};
