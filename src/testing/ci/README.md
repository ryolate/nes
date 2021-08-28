# CI

Run CI.

Run `npx ts-node gs.ts` in ci/ .

## Developer note

### Client

- Node JS API: https://googleapis.dev/nodejs/storage/latest/

### Credentials

Secret key was set up as follows.

Create a Google cloud bucket named `ci-tsnes-324212` from the [browser UI](https://console.cloud.google.com/storage/browser?project=tsnes-324212&prefix=).

* Location type = Region
* Region        = asia-east1
* Storage class = Standard

Create [service account](https://cloud.google.com/storage/docs/reference/libraries?hl=ja#setting_up_authentication), name it "ci-uploader", and allow it to create storage objects.
Create a key for the account, download json file under ci/, and rename it `ci-uploader_secret_key.json` .
