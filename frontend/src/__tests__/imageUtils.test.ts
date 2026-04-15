import {describe, it, expect} from 'vitest';
import {isImageFile} from '../utils/imageUtils';

describe('isImageFile', () => {
	it('returns true for jpg', () => {
		expect(isImageFile('photo.jpg')).toBe(true);
	});

	it('returns true for jpeg', () => {
		expect(isImageFile('photo.jpeg')).toBe(true);
	});

	it('returns true for png', () => {
		expect(isImageFile('screenshot.png')).toBe(true);
	});

	it('returns true for gif', () => {
		expect(isImageFile('anim.gif')).toBe(true);
	});

	it('returns true for webp', () => {
		expect(isImageFile('banner.webp')).toBe(true);
	});

	it('returns true for svg', () => {
		expect(isImageFile('icon.svg')).toBe(true);
	});

	it('is case-insensitive', () => {
		expect(isImageFile('PHOTO.JPG')).toBe(true);
		expect(isImageFile('Photo.PNG')).toBe(true);
	});

	it('returns false for pdf', () => {
		expect(isImageFile('report.pdf')).toBe(false);
	});

	it('returns false for txt', () => {
		expect(isImageFile('notes.txt')).toBe(false);
	});

	it('returns false for a path ending in a folder', () => {
		expect(isImageFile('photos/')).toBe(false);
	});

	it('returns true for image in a subfolder path', () => {
		expect(isImageFile('photos/summer/beach.jpg')).toBe(true);
	});
});
