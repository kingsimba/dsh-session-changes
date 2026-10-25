import { h, react } from "../react.js";

/**
 * Keep one broken render from blanking the whole pane: show the reason and a Retry
 * button instead. Without a class component to extend, the bare tab is used.
 */
export const TabBoundary =
  typeof react.Component !== "function"
    ? null
    : class TabBoundary extends react.Component {
        constructor(props) {
          super(props);
          this.state = { failure: null };
        }

        static getDerivedStateFromError(failure) {
          return { failure };
        }

        render() {
          const failure = this.state.failure;
          if (failure === null || failure === undefined) return this.props.children;
          const message =
            typeof failure === "object" && failure !== null && typeof failure.message === "string"
              ? failure.message
              : String(failure);
          return h("div", { className: "dsc-note" }, [
            h("span", { key: "m" }, "Changes failed to render: " + message),
            h(
              "button",
              {
                type: "button",
                className: "dsc-btn",
                key: "b",
                onClick: () => this.setState({ failure: null }),
              },
              "Retry",
            ),
          ]);
        }
      };
