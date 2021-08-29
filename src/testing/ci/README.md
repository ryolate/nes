# CI

Run CI.

## Usage

Run tests and upload resulting images:

* `npx ts-node ./src/testing/ci/golden_gen.ts --upload`

Run tests and store resulting images to local temporary directory:

* `npx ts-node ./src/testing/ci/golden_gen.ts`

Each entry in `target.txt` specifies a nes file to run. By default they run for
60 frames, but optional second element can override it.
Lines starting with `#` are comments. 

```
# Run cpu test for 15 frames
testdata/nes-test-roms/branch_timing_tests/1.Branch_Basics.nes 15
```

Images are stored in the path `<dir>/<basename>@<frame>.png`. In the case
above, it's stored as `branch_timing_tests/1.Branch_Basics.nes@15.png`.

For GS upload, files are stored under the directory `<timestamp>-<hash>`,
where `<timestamp>` is the unix timestamp and `<hash>` is the Git commit hash.
GS upload fails when the directory is not clean.

## Developer note

### Client

- Node JS API: https://googleapis.dev/nodejs/storage/latest/

### Credentials

Secret key was set up as follows.

Create a Google cloud bucket named `ci-tsnes-324212` from the
[browser UI](https://console.cloud.google.com/storage/browser?project=tsnes-324212&prefix=).

* Location type = Region
* Region        = asia-east1
* Storage class = Standard

Create [service account](https://cloud.google.com/storage/docs/reference/libraries?hl=ja#setting_up_authentication), name it "ci-uploader", and allow it to create storage objects.
Create a key for the account, download json file under ci/, and rename it `ci-uploader_secret_key.json` .

### GS files

* $bucket/${commit_time_stamp}-${hash}/...  -- test results
