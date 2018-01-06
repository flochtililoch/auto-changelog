import semver from 'semver'

import { niceDate } from './utils'

const MERGE_COMMIT_PATTERN = /^Merge (remote-tracking )?branch '.+'/

export function validateVersion (version, prefix = '') {
  const matches = version && version.match(new RegExp(prefix + '(.*)'))
  if (matches && matches[1] && semver.valid(matches[1])) {
    return matches[1]
  }
  return null
}

export function parseReleases (commits, origin, latestVersion, options) {
  let release = newRelease(latestVersion)
  const releases = []
  for (let commit of commits) {
    if (commit.tag) {
      const commitVersion = validateVersion(commit.tag, options.releasePrefix);
      if (commitVersion) {
        if (release.tag || options.unreleased) {
          const releaseVersion = validateVersion(release.tag, options.releasePrefix);
          releases.push({
            ...release,
            href: getCompareLink(commit.tag, release.tag || 'HEAD', origin),
            commits: release.commits.sort(sortCommits),
            major: commit.tag && release.tag && semver.diff(commitVersion, releaseVersion) === 'major'
          })
        }
        release = newRelease(commit.tag, commit.date)
      }
    }
    if (commit.merge) {
      release.merges.push(commit.merge)
    } else if (commit.fixes) {
      release.fixes.push({
        fixes: commit.fixes,
        commit
      })
    } else if (filterCommit(commit, release, options.commitLimit, options.releasePrefix)) {
      release.commits.push(commit)
    }
  }
  releases.push(release)
  return releases
}

function newRelease (tag = null, date = new Date().toISOString()) {
  const release = {
    commits: [],
    fixes: [],
    merges: [],
    tag,
    date,
    title: tag || 'Unreleased',
    niceDate: niceDate(date),
    isoDate: date.slice(0, 10)
  }
  return release
}

function filterCommit (commit, release, limit, releasePrefix) {
  if (validateVersion(commit.subject, releasePrefix)) {
    // Filter out version commits
    return false
  }
  if (MERGE_COMMIT_PATTERN.test(commit.subject)) {
    // Filter out merge commits
    return false
  }
  if (release.merges.findIndex(m => m.message === commit.subject) !== -1) {
    // Filter out commits with the same message as an existing merge
    return false
  }
  if (limit === false) {
    return true
  }
  return release.commits.length < limit
}

function getCompareLink (from, to, origin) {
  if (origin.hostname === 'bitbucket.org') {
    return `${origin.url}/compare/${to}%0D${from}`
  }
  return `${origin.url}/compare/${from}...${to}`
}

function sortCommits (a, b) {
  return (b.insertions + b.deletions) - (a.insertions + a.deletions)
}
