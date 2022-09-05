import type * as RMOAS from '../src/rmoas.types';

import $RefParser from '@readme/json-schema-ref-parser';
import petstoreSpec from '@readme/oas-examples/3.0/json/petstore.json';
import chai, { expect } from 'chai';
import { jestSnapshotPlugin } from 'mocha-chai-jest-snapshot';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

import Oas, { Operation, Webhook, utils } from '../src';

chai.use(jestSnapshotPlugin());
chai.use(sinonChai);

let petstore: Oas;
let webhooks: Oas;
let pathMatchingQuirks: Oas;
let pathVariableQuirks: Oas;
let serverVariables: Oas;

describe('oas', function () {
  before(async function () {
    petstore = await import('@readme/oas-examples/3.0/json/petstore.json').then(r => r.default).then(Oas.init);
    webhooks = await import('@readme/oas-examples/3.1/json/webhooks.json').then(r => r.default).then(Oas.init);
    pathMatchingQuirks = await import('./__datasets__/path-matching-quirks.json').then(r => r.default).then(Oas.init);
    pathVariableQuirks = await import('./__datasets__/path-variable-quirks.json').then(r => r.default).then(Oas.init);
    serverVariables = await import('./__datasets__/server-variables.json').then(r => r.default).then(Oas.init);
  });

  it('should export utils', function () {
    expect(utils.findSchemaDefinition).to.be.a('function');
    expect(utils.jsonSchemaTypes).to.be.a('object');
    expect(utils.matchesMimeType).to.be.a('object');
  });

  it('should be able to access properties on the class instance', function () {
    expect(petstore.api.info.version).to.equal('1.0.0');
  });

  it('should be able to accept an `RMOAS.OASDocument` in the constructor', function () {
    expect(new Oas(petstoreSpec as RMOAS.OASDocument).getVersion()).to.equal('3.0.0');
  });

  describe('#init()', function () {
    it('should return an instance of Oas with a user', function () {
      const user = { username: 'buster' };
      const oas = Oas.init(petstoreSpec, user);

      expect(oas).to.be.an.instanceOf(Oas);
      expect(oas.api).to.deep.equal(petstoreSpec);
      expect(oas.user).to.deep.equal(user);
    });
  });

  describe('#getVersion()', function () {
    it('should be able to identify an OpenAPI definition', function () {
      expect(petstore.getVersion()).to.equal('3.0.0');
      expect(webhooks.getVersion()).to.equal('3.1.0');
    });

    it('should throw an error if unable to identify', function () {
      expect(() => {
        return Oas.init({}).getVersion();
      }).to.throw('Unable to recognize what specification version this API definition conforms to.');
    });
  });

  describe('#url([selected])', function () {
    it('should trim surrounding whitespace from the url', function () {
      expect(Oas.init({ servers: [{ url: '  http://example.com/' }] }).url()).to.equal('http://example.com');
    });

    it('should remove end slash from the server URL', function () {
      expect(Oas.init({ servers: [{ url: 'http://example.com/' }] }).url()).to.equal('http://example.com');
    });

    it('should default missing servers array to example.com', function () {
      expect(Oas.init({}).url()).to.equal('https://example.com');
    });

    it('should default empty servers array to example.com', function () {
      expect(Oas.init({ servers: [] }).url()).to.equal('https://example.com');
    });

    it('should default empty server object to example.com', function () {
      expect(Oas.init({ servers: [{}] }).url()).to.equal('https://example.com');
    });

    it('should add https:// if url starts with //', function () {
      expect(Oas.init({ servers: [{ url: '//example.com' }] }).url()).to.equal('https://example.com');
    });

    it('should add https:// if url does not start with a protocol', function () {
      expect(Oas.init({ servers: [{ url: 'example.com' }] }).url()).to.equal('https://example.com');
    });

    it('should accept an index for servers selection', function () {
      expect(Oas.init({ servers: [{ url: 'example.com' }, { url: 'https://api.example.com' }] }).url(1)).to.equal(
        'https://api.example.com'
      );
    });

    it('should default to first if selected is not valid', function () {
      expect(Oas.init({ servers: [{ url: 'https://example.com' }] }).url(10)).to.equal('https://example.com');
    });

    it('should make example.com the origin if none is present', function () {
      expect(Oas.init({ servers: [{ url: '/api/v3' }] }).url()).to.equal('https://example.com/api/v3');
    });

    describe('server variables', function () {
      const oas = new Oas({
        openapi: '3.0.0',
        info: {
          title: 'testing',
          version: '1.0.0',
        },
        servers: [
          {
            url: 'https://{name}.example.com:{port}/{basePath}',
            variables: {
              name: {
                default: 'demo',
              },
              port: {
                default: '443',
              },
              basePath: {
                default: 'v2',
              },
            },
          },
        ],
        paths: {},
      });

      it('should use default variables if no variables are supplied', function () {
        expect(oas.url(0)).to.equal('https://demo.example.com:443/v2');
      });

      it('should prefill in variables if supplied', function () {
        expect(oas.url(0, { basePath: 'v3', name: 'subdomain', port: '8080' })).to.equal(
          'https://subdomain.example.com:8080/v3'
        );
      });

      it('should use defaults', function () {
        expect(
          new Oas({
            openapi: '3.0.0',
            info: {
              title: 'testing',
              version: '1.0.0',
            },
            servers: [{ url: 'https://example.com/{path}', variables: { path: { default: 'path' } } }],
            paths: {},
          }).url()
        ).to.equal('https://example.com/path');
      });

      it('should use user variables over defaults', function () {
        expect(
          new Oas(
            {
              openapi: '3.0.0',
              info: {
                title: 'testing',
                version: '1.0.0',
              },
              servers: [{ url: 'https://{username}.example.com', variables: { username: { default: 'demo' } } }],
              paths: {},
            },
            { username: 'domh' }
          ).url()
        ).to.equal('https://domh.example.com');
      });

      it('should fetch user variables from keys array', function () {
        expect(
          new Oas(
            {
              openapi: '3.0.0',
              info: {
                title: 'testing',
                version: '1.0.0',
              },
              servers: [{ url: 'https://{username}.example.com', variables: { username: { default: 'demo' } } }],
              paths: {},
            },
            { keys: [{ name: 1, username: 'domh' }] }
          ).url()
        ).to.equal('https://domh.example.com');
      });

      it('should look for variables in selected server', function () {
        expect(
          new Oas({
            openapi: '3.0.0',
            info: {
              title: 'testing',
              version: '1.0.0',
            },
            servers: [
              { url: 'https://{username1}.example.com', variables: { username1: { default: 'demo1' } } },
              { url: 'https://{username2}.example.com', variables: { username2: { default: 'demo2' } } },
            ],
            paths: {},
          }).url(1)
        ).to.equal('https://demo2.example.com');
      });

      // Test encodeURI
      it('should pass through if no default set', function () {
        expect(Oas.init({ servers: [{ url: 'https://example.com/{path}' }] }).url()).to.equal(
          'https://example.com/{path}'
        );
      });
    });
  });

  describe('#replaceUrl()', function () {
    const url = 'https://{name}.example.com:{port}/{basePath}';

    it('should pull data from user variables', function () {
      const oas = Oas.init({}, { name: 'mysubdomain', port: '8000', basePath: 'v5' });
      expect(oas.replaceUrl(url)).to.equal('https://mysubdomain.example.com:8000/v5');
    });

    it('should use template names as variables if no variables are supplied', function () {
      expect(Oas.init({}).replaceUrl(url)).to.equal(url);
    });

    it('should allow variables to come in as an object of defaults from `oas.defaultVariables`', function () {
      expect(
        Oas.init({}).replaceUrl(url, {
          name: {
            default: 'demo',
          },
          port: {
            default: '443',
          },
          basePath: {
            default: 'v2',
          },
        })
      ).to.equal('https://demo.example.com:443/v2');
    });

    it('should allow variable key-value pairs to be supplied', function () {
      expect(
        Oas.init({}).replaceUrl(url, {
          name: 'subdomain',
          port: '8080',
          basePath: 'v3',
        })
      ).to.equal('https://subdomain.example.com:8080/v3');
    });

    it('should not fail if the variable objects are in weird shapes', function () {
      expect(
        Oas.init({}).replaceUrl(url, {
          name: {
            // This would normally have something like `default: 'demo'` but we're testing a weird
            // case here.
          },
          port: '443',
          basePath: [{ default: 'v2' }],
        })
      ).to.equal('https://{name}.example.com:443/{basePath}');
    });
  });

  describe('#splitUrl()', function () {
    it('should split url into chunks', function () {
      expect(
        Oas.init({
          servers: [{ url: 'https://example.com/{path}' }],
        }).splitUrl()
      ).to.deep.equal([
        { key: 'https://example.com/-0', type: 'text', value: 'https://example.com/' },
        { key: 'path-1', type: 'variable', value: 'path', description: undefined, enum: undefined },
      ]);
    });

    it('should work for multiple path params', function () {
      expect(
        Oas.init({
          servers: [{ url: 'https://example.com/{a}/{b}/c' }],
        }).splitUrl()
      ).to.have.lengthOf(5);

      expect(
        Oas.init({
          servers: [{ url: 'https://example.com/v1/flight/{FlightID}/sitezonetargeting/{SiteZoneTargetingID}' }],
        }).splitUrl()
      ).to.have.lengthOf(4);
    });

    it('should create unique keys for duplicate values', function () {
      expect(
        Oas.init({
          servers: [{ url: 'https://example.com/{test}/{test}' }],
        }).splitUrl()
      ).to.deep.equal([
        { key: 'https://example.com/-0', type: 'text', value: 'https://example.com/' },
        { key: 'test-1', type: 'variable', value: 'test', description: undefined, enum: undefined },
        { key: '/-2', type: 'text', value: '/' },
        { key: 'test-3', type: 'variable', value: 'test', description: undefined, enum: undefined },
      ]);
    });

    it('should return with description', function () {
      expect(
        new Oas({
          openapi: '3.0.0',
          info: { title: 'testing', version: '1.0.0' },
          servers: [
            {
              url: 'https://example.com/{path}',
              variables: { path: { default: 'buster', description: 'path description' } },
            },
          ],
          paths: {},
        }).splitUrl()[1].description
      ).to.equal('path description');
    });

    it('should return with enum values', function () {
      expect(
        new Oas({
          openapi: '3.0.0',
          info: { title: 'testing', version: '1.0.0' },
          servers: [{ url: 'https://example.com/{path}', variables: { path: { default: 'v1', enum: ['v1', 'v2'] } } }],
          paths: {},
        }).splitUrl()[1].enum
      ).to.deep.equal(['v1', 'v2']);
    });
  });

  describe('#splitVariables()', function () {
    it('should return false if no match was found', function () {
      expect(Oas.init({}).splitVariables('https://local.dev')).to.be.false;
    });

    it('should not return any variables for a server url that has none', function () {
      expect(
        Oas.init({ servers: [{ url: 'https://example.com' }] }).splitVariables('https://example.com')
      ).to.deep.equal({
        selected: 0,
        variables: {},
      });
    });

    it('should find and return variables', function () {
      const oas = new Oas({
        openapi: '3.0.0',
        info: { title: 'testing', version: '1.0.0' },
        servers: [
          {
            url: 'http://{name}.local/{basePath}',
            variables: {
              name: { default: 'demo' },
              basePath: { default: 'v2' },
            },
          },
          {
            url: 'https://{name}.example.com:{port}/{basePath}',
            variables: {
              name: { default: 'demo' },
              port: { default: '443' },
              basePath: { default: 'v2' },
            },
          },
        ],
        paths: {},
      });

      const url = 'https://buster.example.com:3000/pet';
      const split = oas.splitVariables(url) as { selected: number; variables: Record<string, string | number> };

      expect(split).to.deep.equal({
        selected: 1,
        variables: {
          name: 'buster',
          port: '3000',
          basePath: 'pet',
        },
      });

      expect(oas.url(split.selected, split.variables)).to.equal(url);
    });

    // Surprisingly this is valid by the spec. :cowboy-sweat:
    it('should handle if a variable is duped in the server url', function () {
      const oas = new Oas({
        openapi: '3.0.0',
        info: { title: 'testing', version: '1.0.0' },
        servers: [
          {
            url: 'http://{region}.api.example.com/region/{region}/{lang}',
            variables: {
              region: { default: 'us' },
              lang: { default: 'en-US' },
            },
          },
        ],
        paths: {},
      });

      expect(oas.splitVariables('http://eu.api.example.com/region/eu/fr-CH')).to.deep.equal({
        selected: 0,
        variables: {
          region: 'eu',
          lang: 'fr-CH',
        },
      });
    });
  });

  describe('#variables([selected])', function () {
    it('should return with list of variables', function () {
      const variables = { path: { default: 'buster', description: 'path description' } };
      expect(
        new Oas({
          openapi: '3.0.0',
          info: { title: 'testing', version: '1.0.0' },
          servers: [{ url: 'https://example.com/{path}', variables }],
          paths: {},
        }).variables()
      ).to.deep.equal(variables);
    });

    it('should return with empty object if out of bounds', function () {
      expect(
        new Oas({
          openapi: '3.0.0',
          info: { title: 'testing', version: '1.0.0' },
          servers: [
            {
              url: 'https://example.com/{path}',
              variables: { path: { default: 'buster', description: 'path description' } },
            },
          ],
          paths: {},
        }).variables(10)
      ).to.deep.equal({});
    });
  });

  describe('#defaultVariables([selected])', function () {
    it('should return with list of variables', function () {
      expect(
        new Oas({
          openapi: '3.0.0',
          info: { title: 'testing', version: '1.0.0' },
          servers: [
            {
              url: 'https://example.com/{path}',
              variables: {
                path: { default: '', description: 'path description' },
                port: { default: '8000' },
              },
            },
          ],
          paths: {},
        }).defaultVariables()
      ).to.deep.equal({ path: '', port: '8000' });
    });

    it('should embellish with user variables', function () {
      expect(
        new Oas(
          {
            openapi: '3.0.0',
            info: { title: 'testing', version: '1.0.0' },
            servers: [
              {
                url: 'https://example.com/{path}',
                variables: {
                  path: { default: 'default-path', description: 'path description' },
                  port: { default: '8000' },
                },
              },
            ],
            paths: {},
          },
          {
            path: 'user-path',
          }
        ).defaultVariables()
      ).to.deep.equal({ path: 'user-path', port: '8000' });
    });

    it('should return with empty object if out of bounds', function () {
      expect(
        new Oas({
          openapi: '3.0.0',
          info: { title: 'testing', version: '1.0.0' },
          servers: [
            {
              url: 'https://example.com/{path}',
              variables: { path: { default: 'buster', description: 'path description' } },
            },
          ],
          paths: {},
        }).variables(10)
      ).to.deep.equal({});
    });
  });

  describe('#operation()', function () {
    it('should return an Operation object', function () {
      const operation = petstore.operation('/pet', 'post');

      expect(operation).to.be.an.instanceOf(Operation);
      expect(operation.path).to.equal('/pet');
      expect(operation.method).to.equal('post');

      expect(operation.schema.tags).to.deep.equal(['pet']);
      expect(operation.schema.summary).to.equal('Add a new pet to the store');
      expect(operation.schema.description).to.equal('');
      expect(operation.schema.operationId).to.equal('addPet');
      expect(operation.schema.responses).to.be.a('object');
      expect(operation.schema.security).to.be.a('array');
      expect(operation.schema.requestBody).to.be.a('object');
    });

    it('should return a Webhook object for a webhook', function () {
      const operation = webhooks.operation('newPet', 'post', { isWebhook: true });

      expect(operation).to.be.an.instanceOf(Webhook);
      expect(operation.path).to.equal('newPet');
      expect(operation.method).to.equal('post');
      expect(operation.schema.requestBody).to.be.a('object');
      expect(operation.schema.responses[200]).to.be.a('object');
    });

    it('should return a default when no operation', function () {
      const operation = Oas.init({}).operation('/unknown', 'get');

      expect(operation.schema).to.deep.equal({ parameters: [] });
      expect(operation.api).to.deep.equal({});
      expect(operation.path).to.equal('/unknown');
      expect(operation.method).to.equal('get');
      expect(operation.contentType).to.be.undefined;
      expect(operation.requestBodyExamples).to.be.undefined;
      expect(operation.responseExamples).to.be.undefined;
      expect(operation.callbackExamples).to.be.undefined;
    });

    it('should return an operation object with security if it has security', function () {
      const operation = petstore.operation('/pet', 'put');
      expect(operation.getSecurity()).to.deep.equal([{ petstore_auth: ['write:pets', 'read:pets'] }]);
    });

    it("should still return an operation object if the operation isn't found", function () {
      const operation = petstore.operation('/pet', 'patch');

      expect(operation.schema).to.deep.equal({ parameters: [] });
      expect(operation.api).to.have.property('openapi').and.equal('3.0.0');
      expect(operation.path).to.equal('/pet');
      expect(operation.method).to.equal('patch');
      expect(operation.contentType).to.be.undefined;
      expect(operation.requestBodyExamples).to.be.undefined;
      expect(operation.responseExamples).to.be.undefined;
      expect(operation.callbackExamples).to.be.undefined;
    });

    it('should still return an operation object if the supplied API definition was `undefined`', function () {
      const operation = Oas.init(undefined).operation('/pet', 'patch');

      expect(operation.schema).to.deep.equal({
        parameters: [],
      });

      expect(operation.api).to.be.undefined;
      expect(operation.path).to.equal('/pet');
      expect(operation.method).to.equal('patch');
      expect(operation.contentType).to.be.undefined;
      expect(operation.requestBodyExamples).to.be.undefined;
      expect(operation.responseExamples).to.be.undefined;
      expect(operation.callbackExamples).to.be.undefined;
    });
  });

  describe('#findOperation()', function () {
    it('should return undefined if no server found', function () {
      const uri = 'http://localhost:3000/pet/1';
      const method = 'delete';

      const res = petstore.findOperation(uri, method);
      expect(res).to.be.undefined;
    });

    it('should return undefined if origin is correct but unable to extract path', function () {
      const uri = 'http://petstore.swagger.io/';
      const method = 'get';

      const res = petstore.findOperation(uri, method);
      expect(res).to.be.undefined;
    });

    it('should return undefined if no path matches found', function () {
      const uri = 'http://petstore.swagger.io/v2/search';
      const method = 'get';

      const res = petstore.findOperation(uri, method);
      expect(res).to.be.undefined;
    });

    it('should return undefined if no matching methods in path', function () {
      const uri = 'http://petstore.swagger.io/v2/pet/1';
      const method = 'patch';

      const res = petstore.findOperation(uri, method);
      expect(res).to.be.undefined;
    });

    it('should return a result if found', function () {
      const uri = 'http://petstore.swagger.io/v2/pet/1';
      const method = 'delete';

      const res = petstore.findOperation(uri, method);
      expect(res.url).to.deep.equal({
        origin: 'http://petstore.swagger.io/v2',
        nonNormalizedPath: '/pet/{petId}',
        path: '/pet/:petId',
        slugs: {
          ':petId': '1',
        },
        method: 'DELETE',
      });

      expect(res.operation).to.have.property('operationId').and.equal('deletePet');
    });

    it('should return normally if path is formatted poorly', function () {
      const uri = 'http://petstore.swagger.io/v2/pet/1/';
      const method = 'delete';

      const res = petstore.findOperation(uri, method);
      expect(res.url).to.deep.equal({
        origin: 'http://petstore.swagger.io/v2',
        nonNormalizedPath: '/pet/{petId}',
        path: '/pet/:petId',
        slugs: {
          ':petId': '1',
        },
        method: 'DELETE',
      });

      expect(res.operation).to.have.property('operationId').and.equal('deletePet');
    });

    it('should return object if query string is included', function () {
      const uri = 'http://petstore.swagger.io/v2/pet/findByStatus?test=2';
      const method = 'get';

      const res = petstore.findOperation(uri, method);
      expect(res.url).to.deep.equal({
        origin: 'http://petstore.swagger.io/v2',
        nonNormalizedPath: '/pet/findByStatus',
        path: '/pet/findByStatus',
        slugs: {},
        method: 'GET',
      });

      expect(res.operation).to.have.property('operationId').and.equal('findPetsByStatus');
    });

    it('should support schemeless servers', function () {
      const schemeless = JSON.parse(JSON.stringify(petstoreSpec));
      schemeless.servers = [{ url: '//petstore.swagger.io/v2' }];

      const oas = new Oas(schemeless);
      const uri = 'http://petstore.swagger.io/v2/pet/findByStatus?test=2';
      const method = 'get';

      const res = oas.findOperation(uri, method);
      expect(res.url).to.deep.equal({
        origin: '//petstore.swagger.io/v2',
        nonNormalizedPath: '/pet/findByStatus',
        path: '/pet/findByStatus',
        slugs: {},
        method: 'GET',
      });

      expect(res.operation).to.have.property('operationId', 'findPetsByStatus');
    });

    it('should return result if server has a trailing slash', function () {
      const oas = new Oas({
        openapi: '3.0.0',
        info: { title: 'testing', version: '1.0.0' },
        servers: [
          {
            url: 'https://example.com/',
          },
        ],
        paths: {
          '/pets/:id': {
            get: {
              responses: {
                200: {
                  description: 'OK',
                },
              },
            },
          },
        },
      });

      const uri = 'https://example.com/pets/:id';
      const method = 'get';

      const res = oas.findOperation(uri, method);
      expect(res.url).to.deep.equal({
        origin: 'https://example.com',
        path: '/pets/:id',
        nonNormalizedPath: '/pets/:id',
        slugs: { ':id': ':id' },
        method: 'GET',
      });
    });

    it('should return result if path is slash', function () {
      const oas = new Oas({
        openapi: '3.0.0',
        info: { title: 'testing', version: '1.0.0' },
        servers: [
          {
            url: 'https://example.com',
          },
        ],
        paths: {
          '/': {
            get: {
              responses: {
                200: {
                  description: 'OK',
                },
              },
            },
          },
        },
      });

      const uri = 'https://example.com';
      const method = 'get';

      const res = oas.findOperation(uri, method);
      expect(res.url).to.deep.equal({
        origin: 'https://example.com',
        path: '/',
        nonNormalizedPath: '/',
        slugs: {},
        method: 'GET',
      });

      expect(res.operation).to.deep.equal({
        responses: {
          200: {
            description: 'OK',
          },
        },
      });
    });

    it('should return result if in server variable defaults', function () {
      const uri = 'https://demo.example.com:443/v2/post';
      const method = 'post';

      const res = serverVariables.findOperation(uri, method);
      expect(res.url).to.deep.equal({
        origin: 'https://demo.example.com:443/v2',
        path: '/post',
        nonNormalizedPath: '/post',
        slugs: {},
        method: 'POST',
      });

      expect(res.operation).to.have.property('summary', 'Should fetch variables from defaults and user values');
    });

    it('should render any target server variable defaults', async function () {
      const oas = await import('./__datasets__/petstore-server-vars.json').then(r => r.default).then(Oas.init);
      const uri = 'http://petstore.swagger.io/v2/pet';
      const method = 'post';

      const res = oas.findOperation(uri, method);
      expect(res.url).to.deep.equal({
        origin: 'http://petstore.swagger.io/v2',
        path: '/pet',
        nonNormalizedPath: '/pet',
        slugs: {},
        method: 'POST',
      });

      expect(res.operation).to.have.property('summary').and.equal('Add a new pet to the store');
      expect(res.operation).to.have.property('description').and.equal('');
      expect(res.operation)
        .to.have.property('responses')
        .and.deep.equal({
          405: {
            description: 'Invalid input',
          },
        });
    });

    it('should not overwrite the servers in the core OAS while looking for matches', function () {
      const uri = 'https://demo.example.com:443/v2/post';
      const method = 'post';

      expect(serverVariables.api.servers[0].url).to.equal('https://{name}.example.com:{port}/{basePath}');

      const res = serverVariables.findOperation(uri, method);
      expect(res.url).to.deep.equal({
        origin: 'https://demo.example.com:443/v2',
        path: '/post',
        nonNormalizedPath: '/post',
        slugs: {},
        method: 'POST',
      });

      expect(serverVariables.api.servers[0].url).to.equal('https://{name}.example.com:{port}/{basePath}');
    });

    it('should be able to match against servers with a variable hostname that includes subdomains and a port', function () {
      const uri = 'http://online.example.global:3001/api/public/v1/tables/c445a575-ee58-4aa7/rows/5ba96283-29c2-47f7';
      const method = 'put';

      const res = serverVariables.findOperation(uri, method);
      expect(res.url).to.deep.equal({
        origin: '{protocol}://{hostname}/api/public/v1',
        path: '/tables/:tableId/rows/:rowId',
        nonNormalizedPath: '/tables/{tableId}/rows/{rowId}',
        slugs: {
          ':rowId': '5ba96283-29c2-47f7',
          ':tableId': 'c445a575-ee58-4aa7',
        },
        method: 'PUT',
      });
    });

    describe('quirks', function () {
      it('should return result if the operation path has malformed path parameters', function () {
        const uri = 'https://api.example.com/v2/games/destiny-2/dlc/witch-queen';
        const method = 'get';
        const res = pathMatchingQuirks.findOperation(uri, method);

        expect(res.url).to.deep.equal({
          origin: 'https://api.example.com/v2',
          path: '/games/:game/dlc/:dlcrelease',
          nonNormalizedPath: '/games/{game}/dlc/{dlcrelease}}',
          slugs: { ':game': 'destiny-2', ':dlcrelease': 'witch-queen' },
          method: 'GET',
        });
      });

      it('should support a path parameter that has a hypen in it', function () {
        const uri = 'https://api.example.com/v2/games/destiny-2/platforms/ps5/dlc/witch-queen';
        const method = 'get';
        const res = pathMatchingQuirks.findOperation(uri, method);

        expect(res.url).to.deep.equal({
          origin: 'https://api.example.com/v2',
          path: '/games/:game/platforms/:platform/dlc/:dlcrelease',
          nonNormalizedPath: '/games/{game}/platforms/{platform}/dlc/{dlc-release}',
          slugs: {
            ':game': 'destiny-2',
            ':platform': 'ps5',
            ':dlcrelease': 'witch-queen',
          },
          method: 'GET',
        });
      });

      it('should return a match if a defined server has camelcasing, but the uri is all lower', function () {
        const oas = new Oas({
          openapi: '3.0.0',
          info: { title: 'testing', version: '1.0.0' },
          servers: [{ url: 'https://api.EXAMPLE.com/' }],
          paths: {
            '/anything': {
              get: {
                responses: { 200: { description: 'OK' } },
              },
            },
          },
        });

        const uri = 'https://api.example.com/anything';
        const method = 'get';

        const res = oas.findOperation(uri, method);
        expect(res.url).to.deep.equal({
          origin: 'https://api.EXAMPLE.com',
          path: '/anything',
          nonNormalizedPath: '/anything',
          slugs: {},
          method: 'GET',
        });
      });

      it("should return a match if the uri has variable casing but the defined server doesn't", function () {
        const oas = new Oas({
          openapi: '3.0.0',
          info: { title: 'testing', version: '1.0.0' },
          servers: [{ url: 'https://api.example.com/' }],
          paths: {
            '/anything': {
              get: {
                responses: { 200: { description: 'OK' } },
              },
            },
          },
        });

        const uri = 'https://api.EXAMPLE.com/anything';
        const method = 'get';

        const res = oas.findOperation(uri, method);
        expect(res.url).to.deep.equal({
          origin: 'https://api.example.com',
          path: '/anything',
          nonNormalizedPath: '/anything',
          slugs: {},
          method: 'GET',
        });
      });

      it('should return result if path contains non-variabled colons', function () {
        const uri = 'https://api.example.com/people/GWID:3';
        const method = 'post';

        const res = pathVariableQuirks.findOperation(uri, method);
        expect(res.url).to.deep.equal({
          origin: 'https://api.example.com',
          path: '/people/:personIdType::personId',
          nonNormalizedPath: '/people/{personIdType}:{personId}',
          slugs: { ':personIdType': 'GWID', ':personId': '3' },
          method: 'POST',
        });

        expect(res.operation)
          .to.have.property('parameters')
          .and.deep.equal([
            {
              name: 'personIdType',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
            {
              name: 'personId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ]);
      });

      it('should not error if an unrelated OAS path has a query param in it', function () {
        const uri = 'https://api.example.com/v2/listings';
        const method = 'post';

        const res = pathMatchingQuirks.findOperation(uri, method);
        expect(res.url).to.deep.equal({
          origin: 'https://api.example.com/v2',
          path: '/listings',
          nonNormalizedPath: '/listings',
          slugs: {},
          method: 'POST',
        });
      });

      it('should match a path that has a query param in its OAS path definition', function () {
        const uri = 'https://api.example.com/v2/rating_stats';
        const method = 'get';

        const res = pathMatchingQuirks.findOperation(uri, method);
        expect(res.url).to.deep.equal({
          origin: 'https://api.example.com/v2',
          path: '/rating_stats',
          nonNormalizedPath: '/rating_stats?listing_ids[]=1234567',
          slugs: {},
          method: 'GET',
        });
      });

      it('should match a path that has a hash in its OAS path definition', function () {
        const uri = 'https://api.example.com/v2/listings#hash';
        const method = 'get';

        const res = pathMatchingQuirks.findOperation(uri, method);
        expect(res.url).to.deep.equal({
          origin: 'https://api.example.com/v2',
          path: '/listings#hash',
          nonNormalizedPath: '/listings#hash',
          slugs: {},
          method: 'GET',
        });
      });

      it('should be able to find an operation if `servers` are missing from the API definition', function () {
        const oas = new Oas({
          openapi: '3.0.1',
          info: {
            title: 'Some Test API',
            version: '1',
          },
          paths: {
            '/v1/endpoint': {
              get: {
                responses: {
                  200: {
                    description: 'OK',
                  },
                },
              },
            },
          },
        });

        const uri = 'https://example.com/v1/endpoint';
        const method = 'get';

        const res = oas.findOperation(uri, method);
        expect(res.url).to.deep.equal({
          origin: 'https://example.com',
          path: '/v1/endpoint',
          nonNormalizedPath: '/v1/endpoint',
          slugs: {},
          method: 'GET',
        });
      });

      it('should not error if one of the paths in the API definition has a malformed path parameter', function () {
        const oas = new Oas({
          openapi: '3.0.1',
          info: {
            title: 'Some Test API',
            version: '1',
          },
          paths: {
            '/v1/endpoint': {
              get: {
                responses: {
                  200: {
                    description: 'OK',
                  },
                },
              },
            },
            '/}/v1/endpoint': {
              get: {
                summary:
                  "The path on this operation is malformed and will throw an error in `path-to-regexp` if we don't handle it.",
                responses: {
                  200: {
                    description: 'OK',
                  },
                },
              },
            },
          },
        });

        const uri = 'https://example.com/v1/endpoint';
        const method = 'get';

        // Calling `findOperation` twice in this test so we can make sure that not only does it not
        // throw an exception but that it still returns the data we want.
        expect(() => {
          oas.findOperation(uri, method);
        }).not.to.throw(new TypeError('Unexpected CLOSE at 1, expected END'));

        const res = oas.findOperation(uri, method);
        expect(res.url).to.deep.equal({
          origin: 'https://example.com',
          path: '/v1/endpoint',
          nonNormalizedPath: '/v1/endpoint',
          slugs: {},
          method: 'GET',
        });
      });
    });
  });

  // Since this is just a wrapper for findOperation, we don't need to re-test everything that the
  // tests for that does. All we need to know is that if findOperation fails this fails, as well as
  // the reverse.
  describe('#getOperation()', function () {
    it('should return undefined if #findOperation returns undefined', function () {
      const uri = 'http://localhost:3000/pet/1';
      const method = 'delete';

      expect(petstore.getOperation(uri, method)).to.be.undefined;
    });

    it('should return a result if found', function () {
      const uri = 'http://petstore.swagger.io/v2/pet/1';
      const method = 'delete';

      const res = petstore.getOperation(uri, method);

      expect(res).to.be.an.instanceOf(Operation);
      expect(res.path).to.equal('/pet/{petId}');
      expect(res.method).to.equal('delete');
    });

    it('should have security present on an operation that has it', function () {
      const security = [{ petstore_auth: ['write:pets', 'read:pets'] }];

      expect(petstore.api.paths['/pet'].put.security).to.deep.equal(security);

      const res = petstore.getOperation('http://petstore.swagger.io/v2/pet', 'put');
      expect(res.getSecurity()).to.deep.equal(security);
    });

    it('should handle paths with uri templates', function () {
      const operation = petstore.getOperation('http://petstore.swagger.io/v2/store/order/1234', 'get');

      expect(operation.schema.parameters).to.have.lengthOf(1);
      expect(operation.schema.operationId).to.equal('getOrderById');
      expect(operation.path).to.equal('/store/order/{orderId}');
      expect(operation.method).to.equal('get');
    });

    describe('server variables', function () {
      const apiDefinition = {
        openapi: '3.0.0',
        info: { title: 'testing', version: '1.0.0' },
        servers: [
          {
            url: 'https://{region}.node.example.com/v14',
            variables: {
              region: {
                default: 'us',
                enum: ['us', 'eu'],
              },
            },
          },
        ],
        paths: {
          '/api/esm': {
            put: {
              responses: {
                200: {
                  description: '200',
                },
              },
            },
          },
        },
      };

      it('should be able to find an operation where the variable matches the url', function () {
        const source = {
          url: 'https://eu.node.example.com/v14/api/esm',
          method: 'put',
        };

        const method = source.method.toLowerCase() as RMOAS.HttpMethods;
        const oas = new Oas(apiDefinition, { region: 'eu' });
        const operation = oas.getOperation(source.url, method);

        expect(operation.path).to.equal('/api/esm');
        expect(operation.method).to.equal('put');
      });

      it("should be able to find an operation where the variable **doesn't** match the url", function () {
        const source = {
          url: 'https://eu.node.example.com/v14/api/esm',
          method: 'put' as RMOAS.HttpMethods,
        };

        const oas = new Oas(apiDefinition, { region: 'us' });
        const operation = oas.getOperation(source.url, source.method);

        expect(operation.path).to.equal('/api/esm');
        expect(operation.method).to.equal('put');
      });

      it('should be able to find an operation if there are no user variables present', function () {
        const source = {
          url: 'https://eu.node.example.com/v14/api/esm',
          method: 'put' as RMOAS.HttpMethods,
        };

        const oas = new Oas(apiDefinition);
        const operation = oas.getOperation(source.url, source.method);

        expect(operation.path).to.equal('/api/esm');
        expect(operation.method).to.equal('put');
      });

      it('should fail to find a match on a url that doesnt quite match', function () {
        const source = {
          url: 'https://eu.buster.example.com/v14/api/esm',
          method: 'put' as RMOAS.HttpMethods,
        };

        const oas = new Oas(apiDefinition, { region: 'us' });
        const operation = oas.getOperation(source.url, source.method);

        expect(operation).to.be.undefined;
      });

      it('should be able to find a match on a url with an server OAS that doesnt have fleshed out server variables', function () {
        const oas = new Oas({
          openapi: '3.0.0',
          info: { title: 'testing', version: '1.0.0' },
          servers: [{ url: 'https://{region}.node.example.com/v14' }],
          paths: {
            '/api/esm': {
              put: {
                responses: {
                  200: {
                    description: '200',
                  },
                },
              },
            },
          },
        });

        const source = {
          url: 'https://us.node.example.com/v14/api/esm',
          method: 'put' as RMOAS.HttpMethods,
        };

        const operation = oas.getOperation(source.url, source.method);

        expect(operation.path).to.equal('/api/esm');
        expect(operation.method).to.equal('put');
      });

      it('should be able to find a match on a url that contains colons', function () {
        const source = {
          url: 'https://api.example.com/people/GWID:3',
          method: 'post' as RMOAS.HttpMethods,
        };

        const operation = pathVariableQuirks.getOperation(source.url, source.method);

        expect(operation.path).to.equal('/people/{personIdType}:{personId}');
        expect(operation.method).to.equal('post');
      });
    });
  });

  describe('#findOperationWithoutMethod()', function () {
    it('should return undefined if no server found', function () {
      const uri = 'http://localhost:3000/pet/1';

      const res = petstore.findOperationWithoutMethod(uri);
      expect(res).to.be.undefined;
    });

    it('should return undefined if origin is correct but unable to extract path', function () {
      const uri = 'http://petstore.swagger.io/';

      const res = petstore.findOperationWithoutMethod(uri);
      expect(res).to.be.undefined;
    });

    it('should return undefined if no path matches found', function () {
      const uri = 'http://petstore.swagger.io/v2/search';

      const res = petstore.findOperationWithoutMethod(uri);
      expect(res).to.be.undefined;
    });

    it('should return all results for valid path match', function () {
      const uri = 'http://petstore.swagger.io/v2/pet/1';

      const res = petstore.findOperationWithoutMethod(uri);
      const petIndexResult = petstore.api.paths['/pet/{petId}'];

      const expected = {
        match: {
          index: 0,
          params: {
            petId: '1',
          },
          path: '/pet/1',
        },
        operation: {
          ...petIndexResult,
        },
        url: {
          nonNormalizedPath: '/pet/{petId}',
          origin: 'http://petstore.swagger.io/v2',
          path: '/pet/:petId',
          slugs: {
            ':petId': '1',
          },
        },
      };

      expect(res).to.deep.equal(expected);
    });
  });

  describe('#dereference()', function () {
    it('should not fail on a empty, null or undefined API definitions', async function () {
      await Oas.init({})
        .dereference()
        .then(r => expect(r).to.have.lengthOf(0));

      await Oas.init(undefined)
        .dereference()
        .then(r => expect(r).to.have.lengthOf(0));

      await Oas.init(null)
        .dereference()
        .then(r => expect(r).to.have.lengthOf(0));
    });

    it('should dereference the current OAS', async function () {
      const oas = Oas.init(petstoreSpec);

      expect(oas.api.paths['/pet'].post.requestBody).to.deep.equal({
        $ref: '#/components/requestBodies/Pet',
      });

      await oas.dereference();

      expect(oas.api.paths['/pet'].post.requestBody).to.deep.equal({
        content: {
          'application/json': {
            schema: oas.api.components.schemas.Pet,
          },
          'application/xml': {
            schema: oas.api.components.schemas.Pet,
          },
        },
        description: 'Pet object that needs to be added to the store',
        required: true,
      });
    });

    it('should support `$ref` pointers existing alongside `description` in OpenAPI 3.1 definitions', async function () {
      const oas = await import('./__datasets__/3-1-dereference-handling.json').then(r => r.default).then(Oas.init);
      await oas.dereference();

      expect(oas.api.paths['/'].get.parameters).to.deep.equal([
        {
          description: 'This is an overridden description on the number parameter.',
          in: 'query',
          name: 'number',
          required: false,
          schema: { type: 'integer' },
        },
      ]);

      expect(oas.api.paths['/'].get.responses).to.deep.equal({
        '200': {
          description: 'OK',
          content: {
            '*/*': {
              schema: {
                description: 'This is an overridden description on the response.',
                summary: 'This is an overridden summary on the response.',
                type: 'object',
                properties: { foo: { type: 'string' }, bar: { type: 'number' } },
                'x-readme-ref-name': 'simple-object',
              },
            },
          },
        },
      });
    });

    describe('should add metadata to components pre-dereferencing to preserve their lineage', function () {
      it('stored as `x-readme-ref-name', async function () {
        const oas = await import('./__datasets__/complex-nesting.json').then(r => r.default).then(Oas.init);
        await oas.dereference();
        const schema = (oas.api.paths['/multischema/of-everything'].post.requestBody as RMOAS.RequestBodyObject)
          .content['application/json'].schema as RMOAS.SchemaObject;

        expect(schema.title).to.be.undefined;
        expect(schema['x-readme-ref-name']).to.equal('MultischemaOfEverything');
        expect(oas.api.paths).toMatchSnapshot();
      });

      it('stored as `title` if the `preserveRefAsJSONSchemaTitle` option is supplied', async function () {
        const oas = Oas.init(petstoreSpec);
        await oas.dereference({ preserveRefAsJSONSchemaTitle: true });
        const schema = (oas.api.paths['/pet'].post.requestBody as RMOAS.RequestBodyObject).content['application/json']
          .schema as RMOAS.SchemaObject;

        expect(schema.title).to.equal('Pet');
        expect(schema['x-readme-ref-name']).to.equal('Pet');
        expect(oas.api.paths).toMatchSnapshot();
      });
    });

    it('should retain the user object when dereferencing', async function () {
      const oas = Oas.init(petstoreSpec, {
        username: 'buster',
      });

      expect(oas.user).to.deep.equal({
        username: 'buster',
      });

      await oas.dereference();

      const requestBody = oas.api.paths['/pet'].post.requestBody as RMOAS.RequestBodyObject;

      expect(requestBody.content).to.be.a('object');
      expect(requestBody.description).to.equal('Pet object that needs to be added to the store');
      expect(requestBody.required).to.be.true;

      // User data should remain unchanged
      expect(oas.user).to.deep.equal({
        username: 'buster',
      });
    });

    it('should be able to handle a circular schema without erroring', async function () {
      const oas = await import('./__datasets__/circular.json').then(r => r.default).then(Oas.init);
      await oas.dereference();

      // $refs should remain in the OAS because they're circular and are ignored.
      expect(oas.api.paths['/'].get).to.deep.equal({
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    dateTime: { type: 'string', format: 'date-time' },
                    offsetAfter: { $ref: '#/components/schemas/offset' },
                    offsetBefore: { $ref: '#/components/schemas/offset' },
                  },
                },
              },
            },
          },
        },
      });
    });

    it('should be able to handle OpenAPI 3.1 `pathItem` reference objects', async function () {
      const oas = await import('./__datasets__/pathitems-component.json').then(r => r.default).then(Oas.init);
      await oas.dereference();

      expect(oas.operation('/pet/:id', 'put').schema).to.deep.equal({
        tags: ['pet'],
        summary: 'Update a pet',
        description: 'This operation will update a pet in the database.',
        responses: {
          '400': {
            description: 'Invalid id value',
          },
        },
        security: [
          {
            apiKey: [],
          },
        ],
      });
    });

    describe('blocking', function () {
      // const sandbox = sinon.createSandbox();
      // // let sandbox;
      // // let spy;

      // beforeEach(function () {

      // });

      // afterEach(function () {
      //   sandbox.restore();
      // });

      class TestOas extends Oas {
        // Because `dereferencing` is a protected property we need to create a getter with this new
        // class in order to inspect it.
        getDereferencing() {
          return this.dereferencing;
        }
      }

      it('should only dereference once when called multiple times', async function () {
        const spy = sinon.spy($RefParser, 'dereference');
        const oas = new TestOas(petstoreSpec as RMOAS.OASDocument);
        await Promise.all([oas.dereference(), oas.dereference(), oas.dereference()]);

        expect(spy).to.have.been.calledOnce;
        expect(oas.getDereferencing()).to.deep.equal({ processing: false, complete: true });
        expect(oas.api.paths['/pet'].post.requestBody).not.to.deep.equal({
          $ref: '#/components/requestBodies/Pet',
        });

        spy.restore();
      });

      it('should only **ever** dereference once', async function () {
        const spy = sinon.spy($RefParser, 'dereference');
        const oas = new TestOas(petstoreSpec as RMOAS.OASDocument);
        await oas.dereference();

        expect(oas.getDereferencing()).to.deep.equal({ processing: false, complete: true });
        expect(oas.api.paths['/pet'].post.requestBody).not.to.deep.equal({
          $ref: '#/components/requestBodies/Pet',
        });

        await oas.dereference();

        expect(oas.getDereferencing()).to.deep.equal({ processing: false, complete: true });
        expect(oas.api.paths['/pet'].post.requestBody).not.to.deep.equal({
          $ref: '#/components/requestBodies/Pet',
        });
        expect(spy).to.have.been.calledOnce;

        spy.restore();
      });
    });
  });

  describe('#getPaths()', function () {
    it('should all paths if paths are present', function () {
      const paths = petstore.getPaths();

      expect(Object.keys(paths)).to.have.lengthOf(14);
      expect(paths['/pet'].post).to.be.an.instanceOf(Operation);
      expect(paths['/pet'].put).to.be.an.instanceOf(Operation);
    });

    it('should return an empty object if no paths are present', function () {
      expect(webhooks.getPaths()).to.deep.equal({});
    });

    it("should return an empty object for the path if only only properties present aren't supported HTTP methods", function () {
      const oas = Oas.init({
        openapi: '3.0.0',
        info: {
          version: '1.0.0',
          title: 'Unknown object keys',
        },
        servers: [{ url: 'http://httpbin.org' }],
        paths: {
          '/post': {
            'x-deprecated': true,
          },
        },
      });

      expect(oas.getPaths()).to.deep.equal({
        '/post': {},
      });
    });

    it('should be able to handle OpenAPI 3.1 `pathItem` reference objects without dereferencing', async function () {
      const oas = await import('./__datasets__/pathitems-component.json').then(r => r.default).then(Oas.init);

      const paths = oas.getPaths();

      expect(Object.keys(paths)).to.have.lengthOf(1);
      expect(paths['/pet/:id'].put).to.be.an.instanceOf(Operation);
      expect(paths['/pet/:id'].get).to.be.an.instanceOf(Operation);
    });
  });

  describe('#getWebhooks()', function () {
    it('should all paths if paths are present', function () {
      const hooks = webhooks.getWebhooks();

      expect(Object.keys(hooks)).to.have.lengthOf(1);
      expect(hooks.newPet.post).to.be.an.instanceOf(Webhook);
    });

    it('should return an empty object if no webhooks are present', function () {
      expect(petstore.getWebhooks()).to.deep.equal({});
    });
  });

  describe('#getTags()', function () {
    it('should all tags that are present in a definition', function () {
      expect(petstore.getTags()).to.deep.equal(['pet', 'store', 'user']);
    });

    describe('setIfMissing option', function () {
      it('should return no tags if none are present', function () {
        expect(serverVariables.getTags()).to.have.lengthOf(0);
      });

      it('should ensure that operations without a tag still have a tag set as the path name if `setIfMissing` is true', function () {
        expect(serverVariables.getTags(true)).to.deep.equal(['/post', '/tables/{tableId}/rows/{rowId}']);
      });
    });
  });

  describe('#hasExtension()', function () {
    it('should return true if the extension exists', function () {
      const oas = Oas.init({
        ...petstoreSpec,
        'x-samples-languages': false,
      });

      expect(oas.hasExtension('x-samples-languages')).to.be.true;
    });

    it("should return false if the extension doesn't exist", function () {
      expect(petstore.hasExtension('x-readme')).to.be.false;
    });

    it('should not fail if the Oas instance has no API definition', function () {
      const oas = Oas.init(undefined);
      expect(oas.hasExtension('x-readme')).to.be.false;
    });
  });

  describe('#getExtension()', function () {
    it('should return the extension if it exists', function () {
      const oas = Oas.init({
        ...petstoreSpec,
        'x-readme': {
          'proxy-enabled': true,
        },
      });

      expect(oas.getExtension('x-readme')).to.deep.equal({
        'proxy-enabled': true,
      });
    });

    it("should return nothing if the extension doesn't exist", function () {
      expect(petstore.getExtension('x-readme')).to.be.undefined;
    });

    it('should not fail if the Oas instance has no API definition', function () {
      const oas = Oas.init(undefined);
      expect(oas.getExtension('x-readme')).to.be.undefined;
    });
  });
});
