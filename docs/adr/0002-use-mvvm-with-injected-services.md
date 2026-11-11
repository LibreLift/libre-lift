# Use MVVM with injected asynchronous services

For [#38](https://github.com/LibreLift/libre-lift/issues/38), UI stubs need to behave
like clients of real data while backend features are still being built. Views
therefore render ViewModel state, and ViewModels consume injected asynchronous
service interfaces; the app's root supplies sample data and preference-storage
implementations. This adds a small amount of boundary code compared with embedding
fixtures in screens, but allows service integration and controlled failure testing
without coupling the views to either fixtures or backend clients.
