declare module 'sql.js' {
	export interface SqlJsStatic {
		Database: new (data?: ArrayBuffer | Uint8Array | number[]) => SqlJsDatabase;
	}
	export interface SqlJsDatabase {
		run(sql: string, params?: unknown[]): void;
		exec(sql: string): QueryExecResult[];
		prepare(sql: string): SqlJsStatement;
		export(): Uint8Array;
		close(): void;
	}
	export interface SqlJsStatement {
		bind(params: unknown[]): boolean;
		step(): boolean;
		get(): unknown[];
		getAsObject(): Record<string, unknown>;
		free(): boolean;
	}
	export interface QueryExecResult {
		columns: string[];
		values: unknown[][];
	}
	function initSqlJs(config?: { locateFile?: (file: string) => string }): Promise<SqlJsStatic>;
	export default initSqlJs;
}
