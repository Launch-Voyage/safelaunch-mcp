export declare class ApiClient {
    private baseUrl;
    private key;
    private defaultProject;
    private isAccountKey;
    constructor();
    isConfigured(): boolean;
    /** Whether using account-level key (gr_ak_) vs project key (gr_sk_) */
    isAccountMode(): boolean;
    /** Get default project name from GUARDRAIL_PROJECT env var */
    getDefaultProject(): string | undefined;
    getConfigError(): string;
    postRaw(path: string, body: unknown): Promise<Response>;
    post<T = unknown>(path: string, body: unknown): Promise<T>;
    get<T = unknown>(path: string): Promise<T>;
}
export declare const apiClient: ApiClient;
