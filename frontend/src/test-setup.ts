import '@testing-library/jest-dom';

window.HTMLElement.prototype.scrollIntoView = () => undefined;

global.ResizeObserver = class ResizeObserver {
	public observe() {
		return undefined;
	}
	public unobserve() {
		return undefined;
	}
	public disconnect() {
		return undefined;
	}
};

Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: (query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: () => undefined,
		removeListener: () => undefined,
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
		dispatchEvent: () => false,
	}),
});
