#!/usr/bin/env node

import minimist from "minimist"
import { google } from "googleapis"
import fs from 'fs'

const mandatoryOptions = [
    'serviceAccountKeyFile',
    'packageName',
    'artifactFile',
    'trackName',
    'releaseType'
]

const args = minimist(process.argv.slice(2))
mandatoryOptions.forEach(item => {
    if (!Object.keys(args).includes(item)) {
        console.error('missing option: ' + item)
        process.exit()
    }
})

try {
    const api = await getApi(args.serviceAccountKeyFile, ['https://www.googleapis.com/auth/androidpublisher'])
    const editId = await createEdit(args.packageName)
    const artifact = fs.readFileSync(args.artifactFile)
    const versionCode = await uploadBundle(editId, artifact)
    await prepareRelease(editId, args.packageName, args.trackName, versionCode, args.releaseType !== 'release')
    await release(args.packageName, editId)

    async function getApi(keyFile, scopes) {
        console.log('Authenticating.')
        const auth = new google.auth.GoogleAuth({
            keyFile,
            scopes,
        })
        return google.androidpublisher({
            version: 'v3',
            auth,
        })
    }

    async function createEdit(packageName) {
        console.log('Creating a new edit.')
        const { data } = await api.edits.insert({
            packageName,
        })
        return data.id
    }

    async function uploadBundle(editId, artifact) {
        console.log('Uploading bundle.')
        const { data } = await api.edits.bundles.upload({
            packageName: args.packageName,
            editId,
            media: {
                body: artifact
            }
        })
        return data.versionCode
    }

    async function prepareRelease(editId, packageName, trackName, versionCode, isDraft) {
        console.log('Preparing for release.')
        await api.edits.tracks.update({
            packageName: packageName,
            editId,
            track: trackName,
            requestBody: {
                releases: [{
                    versionCodes: [versionCode],
                    status: isDraft ? 'draft' : 'completed',
                }]
            }
        })
    }

    async function release(packageName, editId) {
        await api.edits.commit({
            packageName,
            editId,
        })
    }
} catch (error) {
    console.error('Unable to publish app to Play Store. Full error:')
    throw error
}
