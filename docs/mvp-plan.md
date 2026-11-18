# MVP Plan: Milestone 1 (Runnable Demo), Nov 18

## 1. What's included

The slice is encapsulated in the following flow: a user logs in using an email and an OTP. They see no seeded data, but are able to create, update, and delete exercise templates using a catalog of exercises. These template changes persist across app sessions. The app client runs on a development build using the Expo Go mobile app. The database, authentication, and backend runs on Supabase.

**Epics:** [#32](https://github.com/open-source-fitness/open-fit/issues/32), [#35](https://github.com/open-source-fitness/open-fit/issues/35), [#40](https://github.com/open-source-fitness/open-fit/issues/40).

**Issues:** [#38](https://github.com/open-source-fitness/open-fit/issues/38), [#39](https://github.com/open-source-fitness/open-fit/issues/39), [#41](https://github.com/open-source-fitness/open-fit/issues/41), [#42](https://github.com/open-source-fitness/open-fit/issues/42), [#43](https://github.com/open-source-fitness/open-fit/issues/43), [#44](https://github.com/open-source-fitness/open-fit/issues/44), [#45](https://github.com/open-source-fitness/open-fit/issues/45), [#46](https://github.com/open-source-fitness/open-fit/issues/46), [#53](https://github.com/open-source-fitness/open-fit/issues/53), [#62](https://github.com/open-source-fitness/open-fit/issues/62), [#63](https://github.com/open-source-fitness/open-fit/issues/63), [#74](https://github.com/open-source-fitness/open-fit/issues/74), [#75](https://github.com/open-source-fitness/open-fit/issues/75), [#76](https://github.com/open-source-fitness/open-fit/issues/76), [#77](https://github.com/open-source-fitness/open-fit/issues/77), [#82](https://github.com/open-source-fitness/open-fit/issues/82), [#83](https://github.com/open-source-fitness/open-fit/issues/83), [#84](https://github.com/open-source-fitness/open-fit/issues/84), [#88](https://github.com/open-source-fitness/open-fit/issues/88), [#89](https://github.com/open-source-fitness/open-fit/issues/89), [#90](https://github.com/open-source-fitness/open-fit/issues/90), [#91](https://github.com/open-source-fitness/open-fit/issues/91), [#94](https://github.com/open-source-fitness/open-fit/issues/94), [#95](https://github.com/open-source-fitness/open-fit/issues/95), [#96](https://github.com/open-source-fitness/open-fit/issues/96), [#97](https://github.com/open-source-fitness/open-fit/issues/97), [#98](https://github.com/open-source-fitness/open-fit/issues/98), [#102](https://github.com/open-source-fitness/open-fit/issues/102), [#103](https://github.com/open-source-fitness/open-fit/issues/103), [#104](https://github.com/open-source-fitness/open-fit/issues/104), [#105](https://github.com/open-source-fitness/open-fit/issues/105), [#107](https://github.com/open-source-fitness/open-fit/issues/107), [#108](https://github.com/open-source-fitness/open-fit/issues/108), [#109](https://github.com/open-source-fitness/open-fit/issues/109), [#110](https://github.com/open-source-fitness/open-fit/issues/110).

## 2. What is deferred:

- **The cut that was made:** improving app performance ([#54](https://github.com/open-source-fitness/open-fit/issues/54)) and ([#55](https://github.com/open-source-fitness/open-fit/issues/55)). I wanted to focus on ensure that there was any app performance at all before improving it.
- **Throwaway corners:** Expo Go app environment for testing. v2 will include real app builds that behave the way users would expect on their smart phones, in terms of app lifecycle.
- **Emergency cut: persistent database** ([#102](https://github.com/open-source-fitness/open-fit/issues/102)). Replace with seeded in-memory data if necessary.

## 3. The risks it addresses:

- "How to provision Supabase Edge functions and DB" is resolved as the MVP will have provisioned edge functions and a functioning database
- "How precisely to represent workout and exercise templates vs workout and exercise sessions/completions in the data model?" is only partially addressed, as the templates portion of the schema is created, not the sessions portion.

#### What it doesn't address:

- iOS distribution will not be considered at this point in the development
- Final save failure recovery is not provable at this point, because exercise sessions are part of M2

## 4. Demo plan

The three claims, ordered by most doubtful to least:

1. **Technical:** Sessions persist across app closures, making logins infrequent
2. **Need:** A user can create a workout template  for desired muscle groups with specific equipment. They can also see images to aid their performance of exercises.
3. **Usability:** An unaided user can navigate from no account to 1 template created in &lt;3 minutes.

*Falsifier: Users get kicked out and have to login every time they close the app.*

#### Script

1. Login with a new, unused email, not touched during testing. Showcase email OTP for auth
2. Create a template or two, demonstrating exercise catalog search, filtering, and template building.
3. Close the app and reopen it without signing in again. Show account info and template data persisting. If a fresh login is required, record that as failure of the technical claim.

#### Fallback

Have a branch with in-memory data ready to showcase template building at the very least.
