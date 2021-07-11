import {promises as Fs, createReadStream} from "fs";
import * as Path from "path";
import * as Crypto from "crypto";
import {Lithograph} from "lithograph";


export async function getFileDirListRecursive(dirPath: string, destination: {files: string[], dirs: string[]} = {files: [], dirs: []}): Promise<{files: string[], dirs: string[]}>{
	let entries = await Fs.readdir(dirPath);
	await Promise.all(entries.map(async entryRaw => {
		let entryPath = Path.resolve(dirPath, entryRaw);
		let stats = await Fs.stat(entryPath);
		if(stats.isDirectory()){
			destination.dirs.push(entryPath);
			await getFileDirListRecursive(entryPath, destination)
		} else {
			destination.files.push(entryPath);
		}
	}))
	return destination;
}

export async function getFileListRecursive(dirPath: string, destination: string[] = []): Promise<string[]>{
	let entries = await Fs.readdir(dirPath);
	await Promise.all(entries.map(async entryRaw => {
		let entryPath = Path.resolve(dirPath, entryRaw);
		let stats = await Fs.stat(entryPath);
		if(stats.isDirectory()){
			await getFileListRecursive(entryPath, destination)
		} else {
			destination.push(entryPath);
		}
	}))
	return destination;
}

export function getFileHash(filePath: string): Promise<string>{
	return new Promise((ok, bad) => {
		try {
			let stream = createReadStream(filePath);
			let hash = Crypto.createHash("MD4");
			stream.on("data", d => hash.update(d));
			stream.on("error", err => bad(err));
			stream.on("end", () => ok(hash.digest("hex")));
		} catch(e){
			bad(e);
		}
	})
}

export function getFileContentHash(bytes: Buffer): string {
	let hash = Crypto.createHash("MD4");
	hash.update(bytes);
	return hash.digest("hex");
}

export async function writeFileAndCreateDirs(path: string, data: string | Buffer): Promise<void>{
	await Fs.mkdir(Path.dirname(path), {recursive: true});
	if(typeof(data) === "string"){
		await Fs.writeFile(path, data, "utf-8");
	} else {
		await Fs.writeFile(path, data);
	}
}

export function createAsyncReadStream(path: string, onData: (data: string | Buffer) => void): Promise<void> {	
	return new Promise((ok, bad) => {
		try {
			let stream = createReadStream(path);
			stream.on("close", ok);
			stream.on("end", ok);
			stream.on("error", bad);
			stream.on("data", onData);
		} catch(e){
			bad(e);
		}
	})
}

export function extensionNoDot(filePath: string): string {
	return Path.extname(filePath).replace(/^./, "").toLowerCase();
}

export function isFilePathContentItemDescription(item: Lithograph.ContentItemDescriptionBase): item is Lithograph.FilePathContentItemDescription {
	return !!(item as Lithograph.FilePathContentItemDescription).filePath
}

export function isNotFound(x: Lithograph.PageRouterResponse): x is Lithograph.RouterResponseNotFound {
	return !!(x as Lithograph.RouterResponseNotFound).notFound;
}

export function isPermRedirect(x: Lithograph.PageRouterResponse): x is Lithograph.RouterResponsePermanentRedirect {
	return !!(x as Lithograph.RouterResponsePermanentRedirect).permanentRedirect;
}

export function isTempRedirect(x: Lithograph.PageRouterResponse): x is Lithograph.RouterResponseTemporaryRedirect {
	return !!(x as Lithograph.RouterResponseTemporaryRedirect).temporaryRedirect;
}

export function isPageRoutingResult(x: Lithograph.PageRouterResponse): x is Lithograph.RouterResponsePage {
	return !!(x as Lithograph.RouterResponsePage).page;
}

export function escapeAttributeValue(value: string): string {
	return value
        .replace(/&/g, '&amp;')
        .replace(/'/g, '&apos;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\r\n/g, "&#10") // or &#13 here?..
        .replace(/[\r\n]/g, "&#10");
}