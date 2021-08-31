# CI

Run CI.

## Usage

Run tests and upload resulting images:

* `npx ts-node ./src/testing/ci/golden_gen.node.ts --upload`

Run tests and store resulting images to local tmp directory:

* `npx ts-node ./src/testing/ci/golden_gen.ts`

Each entry in `target.txt` specifies a nes file to run. By default they run for
60 frames, but optional second element can override it.
Lines starting with `#` are ignored.

```
# Run cpu test for 15 frames
testdata/nes-test-roms/branch_timing_tests/1.Branch_Basics.nes 15
```

Images are stored in the path `<dir>/<basename>@<frame>.png`. In the case
above, it's stored as `branch_timing_tests/1.Branch_Basics.nes@15.png`.

For GS upload, files are stored under the directory `<timestamp>-<hash>`,
where `<timestamp>` is the unix timestamp and `<hash>` is the Git commit hash.
GS upload fails when the workspace is not clean.

## Developer note

### Firestore database schema

See https://console.firebase.google.com/project/tsnes-324212/firestore/data

### Storage files

* $bucket/${commit_time_stamp}-${hash}/...  -- test results

See https://console.firebase.google.com/project/tsnes-324212/storage/tsnes-324212.appspot.com/files

### Github actions

Github action is set up to run test results and upload them on push.

Set `FIREBASE_CONFIG` in Actions secrets page. The content is the same as
`firebase_admin_key.json` .

### Emulator

Use firebase emulator suite.
https://firebase.google.com/docs/emulator-suite/connect_and_prototype

Run emulator on Docker

```
cd firebase_emulator
make build
make init # only once
make run
```

### Credentials

Storage configuration:

* asia-east2
* gs://tsnes-324212.appspot.com
* allow all users to read
* allow authenticated users to write

Go to Firebase console
https://console.firebase.google.com/project/tsnes-324212/overview ,
and create admin credential here
https://console.firebase.google.com/project/tsnes-324212/settings/serviceaccounts/adminsdk .
Download private key and put it as `firebase_admin_key.json` .
