import * as Path from "path";

export interface LithographPathControllerOptions {
	getRootDirectoryPath(): string;
	getPreferredProtocol(): string;
	getDomain(): string;
	getPort(): number | undefined;
}

const absUrlTestingRegexp = /^(?:[a-z][a-z\d\+\-\.]*:)?\/\//i;
export class LithographPathController {

	constructor(private readonly opts: LithographPathControllerOptions){}

	get rootDirectoryPath(): string {
		return this.opts.getRootDirectoryPath();
	}
	
	get urlRoot(): string {
		let port = this.opts.getPort()
		let portPart = port === undefined? "": ":" + port;
		let result = `${this.opts.getPreferredProtocol()}://${this.opts.getDomain()}${portPart}/`;
		if(!result.endsWith("/")){
			result += "/"
		}
		return result;
	}

	/** Does the url has protocol and/or domain, or it's just path (and maybe something further)? */
	isRelativeUrl(url: string): boolean {
		return !absUrlTestingRegexp.test(url);
	}

	isRelativeUrlPath(urlPath: string): boolean {
		return !urlPath.startsWith("/");
	}

	isDirectoryUrlPath(urlPath: string): boolean {
		return urlPath.endsWith("/");
	}

	checkUrlPathIsAbsolute(urlPath: string): void {
		if(this.isRelativeUrlPath(urlPath)){
			throw new Error("Absolute url path was expected here, but got " + urlPath);
		}
	}

	checkUrlPathIsAbsoluteFilePath(urlPath: string): void {
		this.checkUrlPathIsAbsolute(urlPath);

		if(this.isDirectoryUrlPath(urlPath)){
			throw new Error("File url path was expected here, but got " + urlPath);
		}
	}

	resolveFilePath(filePath: string, skipCheck?: boolean): string {
		let rootPath = this.rootDirectoryPath;
		let result = Path.resolve(rootPath, filePath)
		if(!skipCheck && !this.isPathInsidePath(result, rootPath)){
			throw new Error(`File/dir path "${filePath}" is not inside root directory "${rootPath}".`);
		}
		return result;
	}

	pathResolveStable(...pathSegments: string[]): string {
		return Path.resolve(...pathSegments).replace(/\\/g, '/');
	}

	isPathInsidePath(innerPath: string, outerPath: string): boolean {
		let startsWith = innerPath.indexOf(outerPath) === 0;
		if(!startsWith){
			return false;
		}

		let nextChar = innerPath.length === outerPath.length? '': innerPath.charAt(outerPath.length);
		let hasPathTerminator = nextChar === '/' || nextChar === '\\' || nextChar === '';
		return hasPathTerminator;
	}

	resolveUrlPath(urlPath: string, resolveRelativeFrom: string = "/"): string {
		if(this.isRelativeUrlPath(urlPath)){
			urlPath = new URL(urlPath, new URL(resolveRelativeFrom, "http://fakedomain/")).pathname
		}

		return urlPath;
	}

	resolveUrlPathToFullUrl(urlPath: string, resolveRelativeFrom = "/"): string {
		return new URL(this.resolveUrlPath(urlPath, resolveRelativeFrom), this.urlRoot).toString();
	}

	urlPathToFilePath(urlPath: string, resolveRelativeFrom: string = "/"): string {
		urlPath = this.resolveUrlPath(urlPath, resolveRelativeFrom);

		if(urlPath.endsWith("/")){
			// this is BAD.
			// but I don't know what else user may want here
			// maybe I'll parametrize this later when I have more examples
			urlPath += "index.html";
		}
		
		return this.resolveFilePath("." + urlPath);
	}

	filePathToUrlPath(filePath: string): string {
		filePath = this.resolveFilePath(filePath);
		let relFilePath = filePath.substr(this.rootDirectoryPath.length);
		if(!relFilePath.startsWith("/")){
			relFilePath = "/" + relFilePath;
		}
		
		return new URL(relFilePath, this.urlRoot).pathname;
	}

} 