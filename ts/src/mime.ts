// mime-типы по расширениям

let imgs = {
	"png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "ico": "image/x-icon",
    "svg": "image/svg+xml",
    "webp": "image/webp",
    "gif": "image/gif"
}

let fonts = {
	"eot": "application/vnd.ms-fontobject",
    "ttf": "application/x-font-ttf",
    "woff": "application/x-font-woff",
    "woff2": "font/woff2"
}

let all = {
    ...imgs,
    ...fonts,
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "doc": "application/msword",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "xls": "application/vnd.ms-excel",
    "pdf": "application/pdf",
	"txt": "text/plain",
	"apk": "application/vnd.android.package-archive",
    "json": "application/json",
    "css": "text/css",
    "js": "application/javascript",
    "html": "text/html;charset=utf-8",
    "bytes": "application/octet-stream", // better key name here?
    "xml": "application/xml"
}

export const imageMimeTypes: {readonly [extension in keyof typeof imgs]: string} = imgs;
export const fontMimeTypes: {readonly [extension in keyof typeof fonts]: string} = fonts;
export const allKnownMimeTypes: {readonly [extension in keyof typeof all]: string} = all;