#!/bin/bash
set -e
cd `dirname "$0"`
cd ..

scripts/eslint.sh
rm -rf target
rm -rf ts/generated
./node_modules/.bin/imploder --tsconfig tsconfig.json
scripts/generate_dts.sh "lithograph.d.ts"
cp ./package.json ./target/
cp ./LICENSE ./target/
cp ./README.MD ./target/