export interface RepoFile {
    path: string;
    content: string;
}
export declare function scanLocalDirectory(dir: string): Promise<RepoFile[]>;
