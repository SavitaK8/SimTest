export interface ElementSnapshot {
    tag: string;
    id: string;
    type?: string;
    text?: string;
    enabled: boolean;
    visible: boolean;
    role?: string;
    href?: string;
    onclick?: string;
}

export interface StateSnapshot {
    url: string;
    timestamp?: number;
    title?: string;
    interactiveElements?: ElementSnapshot[];
    formData?: Record<string, string>;
    consoleErrors?: string[];
    networkErrors?: Array<{status: number, url: string}>;
    bodyText?: string;
    screenshot?: Buffer;
}

export interface Action {
    type: string;
    selector: string;
    value?: string;
}

export interface Bug {
    id: string;
    severity: 'high' | 'medium' | 'low';
    score: number;
    type: string;
    description: string;
    state: { url: string; timestamp?: number };
    action: Action;
    evidence: {
        errors: string[] | any[];
        screenshot: Buffer | null;
    };
    reproducePath: Action[];
}

export interface GraphData {
    x: number[][];
    edge_index: [number[], number[]];
}
