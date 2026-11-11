# libre-lift

LibreLift is a native mobile app for creating workout templates, recording workout
sessions, and reviewing workout history. It is designed for people who want to
plan and record their training on a phone without paying for a subscription.

**Status**: UI foundation — the Expo app has navigable templates, workout history,
and account screens using sample data. Feature integrations are under development.

## Quickstart

With Node.js 24 LTS and Expo Go for SDK 58 installed:

```sh
npm ci
npm start
```

Connect your phone to the same Wi-Fi network and scan the terminal QR code.
See the [setup guide](./docs/setup.md) for iPhone instructions and validation commands.
It also covers shared hosted Supabase development, an optional local Docker backend,
and maintainer deployment instructions. The UI stub runs without backend credentials.

## Design

The design document for this project is found [here](./docs/design.md). It outlines the following elements of the project:

- Context and scope
- Goals and non-goals
- System-context diagram
- Architecture and components
- Data model
- Technology choices and alternatives considered 
- Risks and open questions
- Implementation plan 

This is the starting point for understanding this project. 

Use the [glossary](./GLOSSARY.md) for shared product terminology. The
[architecture decision records](./docs/adr/README.md) explain the main frontend
boundaries, and the [UI foundation decisions](./docs/ui-foundation.md) capture the
agreed scope and presentation choices for #38.

## Roadmap

See the [roadmap](./docs/roadmap.md) for the scoped MVP and its two milestones,
features planned next, longer-term ideas, and features outside the current plan.

Track current work, priorities, and milestone progress on the
[LibreLift MVP project board](https://github.com/orgs/LibreLift/projects/1).

## Contributing

For instructions on how to get involved and contribute, see the [contributing guidelines](./CONTRIBUTING.md)

## Maintainers:

- James Teuscher

## License

This project uses the Gnu General Public License (GPL) to keep the code open to the public.

This license was selected to ensure the fulfillment of the project's purpose: providing exercise and fitness tool to the general public free of charge. This license aids that purpose by ensuring that any replications or extensions of this source code remains open source and available to the public. 
