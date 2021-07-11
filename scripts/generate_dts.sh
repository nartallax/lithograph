#!/bin/bash
set -e
cd `dirname "$0"`
cd ..

TMP_DTS_FILE="target/tmp.d.ts"
./node_modules/.bin/dts-bundle-generator --out-file "target/$1" --project tsconfig.json --no-banner ts/src/lithograph.ts --no-check
# why I have to do it myself?
sed 's/\/\/\/ *<reference types="sass" *\/>/import * as SASS from "sass";/' "target/$1" |\
	sed 's/export [*] from.*//g' |\
	sed 's/export [{][}].*//g' > $TMP_DTS_FILE
mv $TMP_DTS_FILE "target/$1"