import { expect } from 'chai';

import matchesMimeType from '../../src/lib/matches-mimetype';

describe('matchesMimeType', function () {
  describe('#formUrlEncoded', function () {
    it('should recognize `application/x-www-form-urlencoded`', function () {
      expect(matchesMimeType.formUrlEncoded('application/x-www-form-urlencoded')).to.be.true;
    });
  });

  describe('#json', function () {
    // eslint-disable-next-line mocha/no-setup-in-describe
    [
      'application/json',
      'application/x-json',
      'text/json',
      'text/x-json',
      'application/vnd.github.v3.star+json',
    ].forEach(contentType => {
      it(`should recognize \`${contentType}\``, function () {
        expect(matchesMimeType.json(contentType)).to.be.true;
      });
    });
  });

  describe('#multipart', function () {
    // eslint-disable-next-line mocha/no-setup-in-describe
    ['multipart/mixed', 'multipart/related', 'multipart/form-data', 'multipart/alternative'].forEach(contentType => {
      it('should recognize `%s`', function () {
        expect(matchesMimeType.multipart(contentType)).to.be.true;
      });
    });
  });

  describe('#wildcard', function () {
    it('should recognize `*/*`', function () {
      expect(matchesMimeType.wildcard('*/*')).to.be.true;
    });
  });

  describe('#xml', function () {
    // eslint-disable-next-line mocha/no-setup-in-describe
    [
      'application/xml',
      'application/xml-external-parsed-entity',
      'application/xml-dtd',
      'text/xml',
      'text/xml-external-parsed-entity',
      'application/vnd.github.v3.star+xml',
    ].forEach(contentType => {
      it(`should recognize \`${contentType}\``, function () {
        expect(matchesMimeType.xml(contentType)).to.be.true;
      });
    });
  });
});
