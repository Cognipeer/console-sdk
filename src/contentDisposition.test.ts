import { describe, it, expect } from 'vitest';
import { fileNameFromContentDisposition } from './contentDisposition';

describe('fileNameFromContentDisposition', () => {
  it.each([
    ['attachment; filename="report.pdf"', 'report.pdf'],
    ['inline; filename="my report (final).pdf"', 'my report (final).pdf'],
    ['attachment; filename=report.pdf', 'report.pdf'],
    ['attachment; filename=report.pdf; size=12', 'report.pdf'],
    ['ATTACHMENT; FILENAME="Report.PDF"', 'Report.PDF'],
    ['attachment; filename="say \\"hi\\".txt"', 'say "hi".txt'],
  ])('reads %s', (header, expected) => {
    expect(fileNameFromContentDisposition(header)).toBe(expected);
  });

  it('prefers the RFC 5987 form and decodes UTF-8', () => {
    expect(
      fileNameFromContentDisposition(`attachment; filename="resume.pdf"; filename*=UTF-8''r%C3%A9sum%C3%A9.pdf`),
    ).toBe('résumé.pdf');
    expect(fileNameFromContentDisposition(`attachment; filename*=utf-8'en'caf%C3%A9.txt`)).toBe('café.txt');
  });

  it('decodes ISO-8859-1', () => {
    expect(fileNameFromContentDisposition(`attachment; filename*=ISO-8859-1''caf%E9.txt`)).toBe('café.txt');
  });

  it('falls back to the plain filename when the extended value is malformed or in an unknown charset', () => {
    expect(fileNameFromContentDisposition(`attachment; filename="a.txt"; filename*=UTF-8''%E0%A4%A`)).toBe('a.txt');
    expect(fileNameFromContentDisposition(`attachment; filename="a.txt"; filename*=UTF-7''x`)).toBe('a.txt');
  });

  it('returns the base name only: a path in the header cannot point outside the caller directory', () => {
    expect(fileNameFromContentDisposition('attachment; filename="../../etc/passwd"')).toBe('passwd');
    expect(fileNameFromContentDisposition('attachment; filename="C:\\\\Users\\\\me\\\\a.txt"')).toBe('a.txt');
    expect(fileNameFromContentDisposition(`attachment; filename*=UTF-8''..%2F..%2Fx.txt`)).toBe('x.txt');
    expect(fileNameFromContentDisposition('attachment; filename="../"')).toBeUndefined();
  });

  it('returns undefined without a file name', () => {
    expect(fileNameFromContentDisposition(undefined)).toBeUndefined();
    expect(fileNameFromContentDisposition(null)).toBeUndefined();
    expect(fileNameFromContentDisposition('')).toBeUndefined();
    expect(fileNameFromContentDisposition('inline')).toBeUndefined();
    expect(fileNameFromContentDisposition('attachment; filename=""')).toBeUndefined();
  });
});
