# Contributing to LibreLift

This project welcomes the time and efforts of the community.

## First Steps

To get started do these three things:

- Fork the repo and walk through the [setup guide](./docs/setup.md) to get the app running on your local machine. Ensure that you have a mobile device to test app builds on, or can access iOS/Android simulators.

- Review the [communication standards](./docs/communication-standards.md). This outlines where project communication happens and when to expect responses. 

- Review the [git standards](./docs/git-standards.md) before working. This outlines the process we have established to keep the project organized and maintainable. All contributors and maintainers are expected to follow them.

## Developing

Once you are able to setup and run the project locally, you are ready to start developing. To get started, look for issues marked with the "good first issue" label. These will give you a chance to get acquainted with our development standards and project architecture. For experienced contributors or maintainers, focus efforts on issues with no one else assigned, or those marked "help wanted".

After picking an issue, request a maintainer to assign you to an issue using the method outlined in those standard. If needed, check the [communication standards](./docs/communication-standards.md) to see how to do this.

If you plan on using AI, make sure to review [AI Guidelines] (to be added soon)

## PR Process

To keep PRs a manageable size for humans and agents, there is a cap of one logical change or roughly 1000 lines, whichever comes first. The 1,000 lines is a soft limit as some pull requests will include things like `package-lock.json` that don't need to be heavily reviewed. 

If a single logical change/feature extends beyond 1k lines, split it into multiple PRs or a [stacked PR](https://docs.github.com/en/pull-requests/how-tos/stacked-pull-requests). This will make the review process and the PR history cleaner and more manageable.

## Review Process

When a PR is ready for review, request someone who did not author the PR to review it, either through GitHub of the communication channel.

Having someone who didn't write the code review it will help with the quality of the project. A fresh set of eyes ensures that we aren't making incorrect assumptions or poor design choices.

Usually there will be some discussion about your changes and a few iterations of revision, review, and revision again to find the solution that works best.

After approval from an independent reviewer the PR will be merged into `main`.

