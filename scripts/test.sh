#!/bin/bash
set -e
cd `dirname "$0"`
cd ..

rm -rf target
rm -rf ts/generated
./node_modules/.bin/imploder --tsconfig tsconfig.json --profile test
node target/test.js "$@"