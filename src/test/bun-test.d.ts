import "bun:test";
import "@testing-library/jest-dom";

declare module "bun:test" {
  interface Matchers<T> {
    toBeInTheDocument(): T;
    toBeVisible(): T;
    toBeDisabled(): T;
    toBeEnabled(): T;
    toBeEmptyDOMElement(): T;
    toBeInvalid(): T;
    toBeRequired(): T;
    toBeValid(): T;
    toContainElement(element: HTMLElement | SVGElement | null): T;
    toContainHTML(htmlText: string): T;
    toHaveAttribute(attr: string, value?: any): T;
    toHaveClass(...classNames: string[]): T;
    toHaveFocus(): T;
    toHaveFormValues(expectedValues: { [key: string]: any }): T;
    toHaveStyle(css: string | { [key: string]: any }): T;
    toHaveTextContent(text: string | RegExp, options?: { normalizeWhitespace: boolean }): T;
    toHaveValue(value?: string | string[] | number): T;
    toHaveDisplayValue(value: string | RegExp | Array<string | RegExp>): T;
    toBeChecked(): T;
    toBePartiallyChecked(): T;
    toHaveDescription(text: string | RegExp): T;
  }
}