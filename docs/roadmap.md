# LibreLift roadmap

LibreLift provides free workout planning and logging for individual users. This
roadmap follows the project proposal's feature priorities: P0 is the minimum viable
product (MVP), P1 is the next step, and P2 is longer-term exploration. Work after
the MVP has no committed release dates.

## MVP

The semester MVP lets a user create and reuse workout templates using exercises
from a catalog, start workout sessions using existing templates, and review saved
workout history. It also supports recording exercise maximums and calculating
target weights as percentages of those maximums. These functions are available
without a subscription or payment.

The MVP is scoped to two delivery milestones:

| Milestone | Target date | What a user can do |
| --- | --- | --- |
| [M1: Runnable Demo](https://github.com/LibreLift/libre-lift/milestone/1) | November 18, 2026 | Sign in, choose catalog exercises, and create, save, reopen, edit, and delete a workout template with fixed target weights and repetitions. Workout logging and maximum-based calculations are deferred to M2. |
| [M2: MVP](https://github.com/LibreLift/libre-lift/milestone/2) | December 2, 2026 | Start a workout from a saved template, record actual weights and repetitions, complete or stop the workout, and review its saved history. Record personal exercise maximums and use percentages to calculate template target weights. |

Templates and workout history must persist across app restarts. Editing or reusing
a template must not alter previously logged workouts. The first milestone covers
the complete template-creation workflow; the second adds the workout-logging
workflow and percentage-based planning.

The features below are deferred from the MVP to keep the semester build focused
on these core workflows within the available development time. Contributors can
help with implementation, testing, and documentation; see the
[contribution guide](../CONTRIBUTING.md) and
[project board](https://github.com/orgs/LibreLift/projects/1) for how to get involved
and what work is currently planned.

## Next

These P1 features extend the MVP once the core planning and logging workflows
are established. Their order below follows the CP3 proposal.

1. **Integrated rest timer.** Add a rest timer to the workout experience. This is
   next because it improves an existing workflow without introducing a separate
   product area. It is deferred from the MVP because a timer is not required to
   record a workout. Contributors can help design the controls, implement the
   timer, and test it during workout sessions.
2. **Visual aids for past workout statistics.** Add visualizations of saved workout
   history so users can understand progress over time. This follows basic history
   viewing because the app first needs reliable workout records. Advanced visuals
   are deferred from the MVP, which provides the underlying logs. Contributors
   can help identify useful statistics and build and test their visualizations.

## Later

These P2 features are exploratory ideas from the project proposal. They follow the
MVP and P1 improvements because they expand the app from recording user-created
plans into suggesting plans and starting workouts without an exiting plan, requiring additional design and validation.

1. **Generate one-off workouts or workout plans.** Help users assemble a one-off workouts
   rather than requiring them to create or select a plan. Generated workouts can then be saved as a new template if desired. This is
   deferred until the exercise catalog and template workflows are established.
   Contributors can help define generation rules and check that generated plans
   use the catalog and fit the existing template model.
2. **Suggest workouts for fitness goals or sports training.** Explore suggestions
   tailored to a user's stated goal or sport. This is deferred because the proposal
   identifies a need for more evidence about what users want from planning.
   Contributors can help research those needs, define the supported goals, and
   evaluate suggestions before implementation.

## Not planned

These non-goals from the proposal remain outside the current plan. They are
excluded to protect the semester scope and the focus on individual workout
planning and logging.

- **Nutrition or macro tracking.** This introduces a separate problem area and
  would stretch the project beyond the available build time.
- **Body composition and fitness goal customization.** Automatically prescribing
  workouts, repetitions, or weights using body-profile information such as gender,
  height, and weight is outside the semester scope. The exploratory goal- or
  sport-based suggestions in Later do not commit the project to this broader
  personalization system.
- **Social exercising features.** Friends, followers, workout sharing, comments,
  and cooperative workout logging are excluded because the project prioritizes
  meeting individual users' needs independently.
