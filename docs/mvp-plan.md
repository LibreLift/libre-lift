# MVP Plan: Milestone 1 (Runnable Demo), Nov 18

## 1. What's included

The slice is encapsulated in the following flow: a user logs in using an email and an OTP. They see no seeded data, but are able to create, update, and delete exercise templates using a catalog of exercises. These template changes persist across app sessions. The app client runs in Expo Go from the development server. The database, authentication, and backend runs on Supabase.

**Epics:** [#32](https://github.com/open-source-fitness/open-fit/issues/32), [#35](https://github.com/open-source-fitness/open-fit/issues/35), [#40](https://github.com/open-source-fitness/open-fit/issues/40).

**Issues:** [#38](https://github.com/open-source-fitness/open-fit/issues/38), [#39](https://github.com/open-source-fitness/open-fit/issues/39), [#41](https://github.com/open-source-fitness/open-fit/issues/41), [#42](https://github.com/open-source-fitness/open-fit/issues/42), [#43](https://github.com/open-source-fitness/open-fit/issues/43), [#44](https://github.com/open-source-fitness/open-fit/issues/44), [#45](https://github.com/open-source-fitness/open-fit/issues/45), [#46](https://github.com/open-source-fitness/open-fit/issues/46), [#53](https://github.com/open-source-fitness/open-fit/issues/53), [#62](https://github.com/open-source-fitness/open-fit/issues/62), [#63](https://github.com/open-source-fitness/open-fit/issues/63), [#74](https://github.com/open-source-fitness/open-fit/issues/74), [#75](https://github.com/open-source-fitness/open-fit/issues/75), [#76](https://github.com/open-source-fitness/open-fit/issues/76), [#77](https://github.com/open-source-fitness/open-fit/issues/77), [#82](https://github.com/open-source-fitness/open-fit/issues/82), [#83](https://github.com/open-source-fitness/open-fit/issues/83), [#84](https://github.com/open-source-fitness/open-fit/issues/84), [#88](https://github.com/open-source-fitness/open-fit/issues/88), [#89](https://github.com/open-source-fitness/open-fit/issues/89), [#90](https://github.com/open-source-fitness/open-fit/issues/90), [#91](https://github.com/open-source-fitness/open-fit/issues/91), [#94](https://github.com/open-source-fitness/open-fit/issues/94), [#95](https://github.com/open-source-fitness/open-fit/issues/95), [#96](https://github.com/open-source-fitness/open-fit/issues/96), [#97](https://github.com/open-source-fitness/open-fit/issues/97), [#98](https://github.com/open-source-fitness/open-fit/issues/98), [#102](https://github.com/open-source-fitness/open-fit/issues/102), [#103](https://github.com/open-source-fitness/open-fit/issues/103), [#104](https://github.com/open-source-fitness/open-fit/issues/104), [#105](https://github.com/open-source-fitness/open-fit/issues/105), [#107](https://github.com/open-source-fitness/open-fit/issues/107), [#108](https://github.com/open-source-fitness/open-fit/issues/108), [#109](https://github.com/open-source-fitness/open-fit/issues/109), [#110](https://github.com/open-source-fitness/open-fit/issues/110).

## 2. What is deferred:

- **The cut that was made:** improving app performance ([#54](https://github.com/open-source-fitness/open-fit/issues/54)) and ([#55](https://github.com/open-source-fitness/open-fit/issues/55)). I wanted to focus on ensure that there was any app performance at all before improving it.
- **Throwaway corners:** Expo Go app environment for testing. v2 will include real app builds that behave the way users would expect on their smart phones, in terms of app lifecycle.
- **Emergency cut: template persistence integration** ([#45](https://github.com/open-source-fitness/open-fit/issues/45), built on the database foundation in [#102](https://github.com/open-source-fitness/open-fit/issues/102)). Replace with seeded in-memory data only for a reduced demonstration if necessary. Activating this fallback means the documented M1 scope was not delivered: template persistence and the no-seeded-data flow cannot be claimed, and the backend integration risk remains unresolved.

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

1. Before the run, choose a muscle group and equipment requirement supported by an available catalog exercise with an image. Write those criteria in a task for a first-time participant. Prepare an unused email address and access to its inbox, and open the app signed out. Do not walk the participant through the UI.
2. Ask the participant to create one saved workout template meeting those criteria, without assistance. Start a timer at their first interaction with account access; stop when the newly saved template detail appears. Include email OTP delivery, name entry, exercise selection, and saving in the elapsed time. Record the duration and any help given. A duration of 180 seconds or more, failure to save, or any required assistance fails the unaided three-minute claim.
3. During that run, observe email OTP access and an initially empty template list. The participant must search/filter the catalog, check that the selected exercise targets the chosen muscle group and lists the specified equipment, open its detail and see a loaded exercise image, then add it to the template with valid fixed-weight targets and repetitions. Record the saved name, exercise, and targets. Failure to find a matching exercise, see its image, or save the matching template fails the exercise-selection claim; preexisting sample templates fail the no-seeded-data scope. Equipment is checked from exercise information; an equipment filter is not required.
4. After saving, close the app and reopen it without signing in again. Show the same account info and reopen the template; compare its name, exercise, and targets with the recorded values. A fresh login fails the technical claim; a missing template or changed values fails template persistence.
5. Edit the saved template's name and a set target, save, then close and reopen the app and template. Verify the edited values persist. An unsuccessful save or lost edit fails the M1 edit/persistence flow.
6. Delete the template using its confirmation, then close and reopen the app. Verify the deleted template remains absent from the list. Failed deletion or a reappearing template fails the M1 delete/persistence flow.

#### Fallback

Have a branch with in-memory data ready to showcase template building at the very least. Label this a reduced demonstration, record that M1 persistence was not delivered, and do not count its seeded records or temporary saves as evidence for the full M1 claims.
