import {getFileDirListRecursive} from "lithograph_utils";
import * as Path from "path";
import * as Http from "http";
import { promises as Fs} from "fs";
import * as Clamsensor from "@nartallax/clamsensor";

async function copyRecursive(from: string, to: string): Promise<void>{
	let {files, dirs} = await getFileDirListRecursive(from);

	await Promise.all(dirs.map(absSrcPath => {
		let relPath = Path.relative(from, absSrcPath);
		let absDestPath = Path.resolve(to, relPath);
		return Fs.mkdir(absDestPath, {recursive: true})
	}));

	await Promise.all(files.map(absSrcPath => {
		let relPath = Path.relative(from, absSrcPath);
		let absDestPath = Path.resolve(to, relPath);
		return Fs.copyFile(absSrcPath, absDestPath);
	}))
}


export const defaultTestSiteDirectory = "/tmp/lithograph_test_site_dir";
export const defaultTestPort = 8085;

export const testWithSite = Clamsensor.ClamsensorTestRunner.createTestDefinerFunction({
	getAssertor: () => Clamsensor.ClamsensorDefaultAssertor,
	beforeTest: async () => {
		await Fs.rmdir(defaultTestSiteDirectory, {recursive: true});
		await copyRecursive("./ts/test/generic_site", defaultTestSiteDirectory);
	},
	afterTest: async () => {
		await Fs.rmdir(defaultTestSiteDirectory, {recursive: true});
	}
})

export async function httpGetStr(path: string): Promise<string>{
	let res = await httpGet(path);
	return res.body.toString("utf-8");
}

export function httpGet(path: string): Promise<{code: number, body: Buffer, headers: Http.IncomingHttpHeaders}> {
	return new Promise((ok, bad) => {
		let req = Http.request({
			method: "GET",
			host: "localhost",
			port: 8085,
			path: path
		});

		req.on("response", resp => {
			let result: Buffer[] = [];
			resp.on("data", data => result.push(data));
			resp.on("error", err => bad(err));
			resp.on("end", () => ok({
				body: Buffer.concat(result),
				code: resp.statusCode || -1,
				headers: resp.headers
			}))
		});

		req.end();
	})

}