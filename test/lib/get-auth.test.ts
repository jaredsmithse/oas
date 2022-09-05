import { expect } from 'chai';

import Oas from '../../src';
import getAuth, { getByScheme } from '../../src/lib/get-auth';
import multipleSecurities from '../__datasets__/multiple-securities.json';

// We need to forcetype this definition to an OASDocument because it's got weird use cases in it
// and isn't actually a valid to the spec.
const oas = Oas.init(multipleSecurities);

describe('getAuth', function () {
  it('should not throw on an empty or null API definitions', function () {
    expect(Oas.init(undefined).getAuth({ oauthScheme: 'oauth' })).to.deep.equal({});
    expect(Oas.init(null).getAuth({ oauthScheme: 'oauth' })).to.deep.equal({});
    expect(getAuth(Oas.init(undefined).api, { oauthScheme: 'oauth' })).to.deep.equal({});
    expect(getAuth(Oas.init(null).api, { oauthScheme: 'oauth' })).to.deep.equal({});
  });

  it('should fetch all auths from the OAS files', function () {
    expect(oas.getAuth({ oauthScheme: 'oauth', apiKeyScheme: 'apikey' })).to.deep.equal({
      apiKeyScheme: 'apikey',
      apiKeySignature: null,
      basicAuth: {
        pass: null,
        user: null,
      },
      httpBearer: null,
      oauthDiff: null,
      oauthScheme: 'oauth',
      unknownAuthType: null,
    });
  });

  it('should fetch auths from selected app', function () {
    const user = {
      keys: [
        { oauthScheme: '111', name: 'app-1' },
        { oauthScheme: '222', name: 'app-2' },
      ],
    };

    expect(oas.getAuth(user, 'app-2').oauthScheme).to.equal('222');
  });

  it('should not error if oas.components is not set', function () {
    const user = { oauthScheme: 'oauth', apiKeyScheme: 'apikey' };

    expect(() => {
      Oas.init({}).getAuth(user);
    }).not.to.throw();

    expect(() => {
      Oas.init({ components: {} }).getAuth(user);
    }).not.to.throw();

    expect(() => {
      Oas.init({ components: { schemas: {} } }).getAuth(user);
    }).not.to.throw();
  });

  describe('#getByScheme', function () {
    const topLevelUser = { apiKey: '123456', user: 'user', pass: 'pass' };
    const keysUser = {
      keys: [
        { apiKey: '123456', name: 'app-1' },
        { apiKey: '7890', name: 'app-2' },
      ],
    };

    const topLevelSchemeUser = { schemeName: 'scheme-key' };
    const keysSchemeUser = {
      keys: [
        { schemeName: 'scheme-key-1', name: 'app-1' },
        { schemeName: 'scheme-key-2', name: 'app-2' },
        { schemeName: { user: 'user', pass: 'pass' }, name: 'app-3' },
      ],
    };

    it('should return apiKey property for oauth', function () {
      expect(getByScheme(topLevelUser, { type: 'oauth2', flows: {}, _key: 'authscheme' })).to.equal('123456');
    });

    it('should return apiKey property for apiKey', function () {
      expect(getByScheme(topLevelUser, { type: 'oauth2', flows: {}, _key: 'authscheme' })).to.equal('123456');
    });

    it('should return a default value if scheme is sec0 and default auth provided', function () {
      expect(
        getByScheme(
          {},
          {
            type: 'apiKey',
            name: 'apiKey',
            in: 'query',
            'x-default': 'default',
            _key: 'authscheme',
          }
        )
      ).to.equal('default');
    });

    it('should return apiKey property for bearer', function () {
      expect(getByScheme(topLevelUser, { type: 'http', scheme: 'bearer', _key: 'authscheme' })).to.equal('123456');
    });

    it('should return user/pass properties for basic auth', function () {
      expect(getByScheme(topLevelUser, { type: 'http', scheme: 'basic', _key: 'authscheme' })).to.deep.equal({
        user: 'user',
        pass: 'pass',
      });
    });

    it('should return first item from keys array if no app selected', function () {
      expect(getByScheme(keysUser, { type: 'oauth2', flows: {}, _key: 'authscheme' })).to.equal('123456');
    });

    it('should return selected app from keys array if app provided', function () {
      expect(getByScheme(keysUser, { type: 'oauth2', flows: {}, _key: 'authscheme' }, 'app-2')).to.equal('7890');
    });

    it('should return item by scheme name if no apiKey/user/pass', function () {
      expect(getByScheme(topLevelSchemeUser, { type: 'oauth2', flows: {}, _key: 'schemeName' })).to.equal('scheme-key');
      expect(getByScheme(topLevelSchemeUser, { type: 'http', scheme: 'bearer', _key: 'schemeName' })).to.equal(
        'scheme-key'
      );
      expect(getByScheme(keysSchemeUser, { type: 'oauth2', flows: {}, _key: 'schemeName' })).to.equal('scheme-key-1');
      expect(getByScheme(keysSchemeUser, { type: 'oauth2', flows: {}, _key: 'schemeName' }, 'app-2')).to.equal(
        'scheme-key-2'
      );

      expect(getByScheme(keysSchemeUser, { type: 'http', scheme: 'basic', _key: 'schemeName' }, 'app-3')).to.deep.equal(
        {
          user: 'user',
          pass: 'pass',
        }
      );
    });

    it('should return null for anything else', function () {
      expect(getByScheme({}, { type: 'http', scheme: 'basic', _key: 'schemeName' })).to.deep.equal({
        user: null,
        pass: null,
      });

      expect(getByScheme({}, { type: 'http', scheme: 'bearer', _key: 'schemeName' })).to.be.null;
      expect(getByScheme({}, { type: 'http', scheme: 'unknown', _key: 'schemeName' })).to.be.null;

      expect(getByScheme({ keys: [] }, { type: 'http', scheme: 'bearer', _key: 'schemeName' })).to.be.null;
      expect(getByScheme({ keys: [] }, { type: 'http', scheme: 'unknown', _key: 'schemeName' })).to.be.null;

      // @todo bring these tests back
      // expect(getByScheme(topLevelUser, { type: 'unknown' })).to.be.null;
      // expect(getByScheme(keysUser, { type: 'unknown' })).to.be.null;
      // expect(getByScheme(keysUser, { type: 'unknown' }, 'app-2')).to.be.null;
    });

    it('should allow scheme to be undefined', function () {
      expect(getByScheme(topLevelUser)).to.be.null;
    });
  });
});
