export class ApiKey {
    id: string;
    name: string;
    key: string;
    description: string;
    created: string;
    expires: string;
    enabled: boolean;
}

export class ApiKeys {
    apiKeys: ApiKey[];
}