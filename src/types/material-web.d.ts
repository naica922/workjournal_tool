import type * as React from "react";

// Material Web custom elements used in JSX. They render as-is on the server
// and upgrade to web components on the client.
type MdElementProps<T = Record<string, unknown>> = React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLElement>,
  HTMLElement
> &
  T & { [attr: string]: unknown };

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "md-filled-button": MdElementProps<{ type?: string; disabled?: boolean }>;
      "md-outlined-button": MdElementProps<{
        type?: string;
        disabled?: boolean;
      }>;
      "md-text-button": MdElementProps<{ type?: string; disabled?: boolean }>;
      "md-filled-tonal-button": MdElementProps<{
        type?: string;
        disabled?: boolean;
      }>;
      "md-icon-button": MdElementProps<{ type?: string; disabled?: boolean }>;
      "md-icon": MdElementProps;
      "md-outlined-text-field": MdElementProps<{
        label?: string;
        name?: string;
        type?: string;
        value?: string;
        required?: boolean;
        error?: boolean;
        rows?: number;
        supportingText?: string;
      }>;
      "md-outlined-select": MdElementProps<{
        label?: string;
        name?: string;
        value?: string;
        required?: boolean;
      }>;
      "md-select-option": MdElementProps<{ value?: string; selected?: boolean }>;
      "md-radio": MdElementProps<{
        name?: string;
        value?: string;
        checked?: boolean;
      }>;
      "md-checkbox": MdElementProps<{
        name?: string;
        value?: string;
        checked?: boolean;
      }>;
      "md-switch": MdElementProps<{ name?: string; selected?: boolean }>;
      "md-dialog": MdElementProps<{ open?: boolean }>;
      "md-divider": MdElementProps;
      "md-circular-progress": MdElementProps<{ indeterminate?: boolean }>;
      "md-linear-progress": MdElementProps<{ indeterminate?: boolean }>;
    }
  }
}
