import type * as RMOAS from '../src/rmoas.types';

import petstoreSpec from '@readme/oas-examples/3.0/json/petstore.json';
import chai, { expect } from 'chai';
import { jestSnapshotPlugin } from 'mocha-chai-jest-snapshot';

import Oas, { Operation, Callback } from '../src';

import chaiPlugins from './helpers/chai-plugins';

chai.use(chaiPlugins);
chai.use(jestSnapshotPlugin());

let petstore: Oas;
let callbackSchema: Oas;
let multipleSecurities: Oas;
let securities: Oas;
let referenceSpec: Oas;
let deprecatedSchema: Oas;
let parametersCommon: Oas;
let petstoreNondereferenced: Oas;
let oas31NoResponses: Oas;
let readme: Oas;

describe('operation', function () {
  before(async function () {
    petstore = await import('@readme/oas-examples/3.0/json/petstore.json').then(r => r.default).then(Oas.init);
    await petstore.dereference();

    callbackSchema = await import('./__datasets__/callbacks.json').then(r => r.default).then(Oas.init);
    await callbackSchema.dereference();

    multipleSecurities = await import('./__datasets__/multiple-securities.json').then(r => r.default).then(Oas.init);
    await multipleSecurities.dereference();

    securities = await import('@readme/oas-examples/3.0/json/security.json').then(r => r.default).then(Oas.init);
    await securities.dereference();

    referenceSpec = await import('./__datasets__/local-link.json').then(r => r.default).then(Oas.init);
    await referenceSpec.dereference();

    deprecatedSchema = await import('./__datasets__/schema-deprecated.json').then(r => r.default).then(Oas.init);
    await deprecatedSchema.dereference();

    parametersCommon = await import('./__datasets__/parameters-common.json').then(r => r.default).then(Oas.init);
    await parametersCommon.dereference();

    petstoreNondereferenced = await import('./__datasets__/petstore-nondereferenced.json')
      .then(r => r.default)
      .then(Oas.init);

    oas31NoResponses = await import('./__datasets__/3-1-no-responses.json').then(r => r.default).then(Oas.init);
    await oas31NoResponses.dereference();

    readme = await import('@readme/oas-examples/3.0/json/readme.json').then(r => r.default).then(Oas.init);
    await readme.dereference();
  });

  describe('#constructor', function () {
    it('should accept an API definition', function () {
      const operation = new Operation(petstoreSpec as any, '/test', 'get', { summary: 'operation summary' });
      expect(operation.schema).to.deep.equal({ summary: 'operation summary' });
      expect(operation.api).to.deep.equal(petstoreSpec);
    });
  });

  describe('#getSummary() + #getDescription()', function () {
    it('should return if present', function () {
      const operation = petstore.operation('/pet/findByTags', 'get');

      expect(operation.getSummary()).to.equal('Finds Pets by tags');
      expect(operation.getDescription()).to.equal(
        'Muliple tags can be provided with comma separated strings. Use tag1, tag2, tag3 for testing.'
      );
    });

    it('should return nothing if not present', function () {
      const operation = referenceSpec.operation('/2.0/users/{username}', 'get');

      expect(operation.getSummary()).to.be.undefined;
      expect(operation.getDescription()).to.be.undefined;
    });

    it('should allow a common summary to override the operation-level summary', function () {
      const operation = parametersCommon.operation('/anything/{id}', 'get');

      expect(operation.getSummary()).to.equal('[common] Summary');
      expect(operation.getDescription()).to.equal('[common] Description');
    });

    describe('callbacks', function () {
      it('should return a summary if present', function () {
        const operation = callbackSchema.operation('/callbacks', 'get');
        const callback = operation.getCallback('myCallback', '{$request.query.queryUrl}', 'post') as Callback;

        expect(callback.getSummary()).to.equal('Callback summary');
        expect(callback.getDescription()).to.equal('Callback description');
      });

      it('should return nothing if present', function () {
        const operation = callbackSchema.operation('/callbacks', 'get');
        const callback = operation.getCallback(
          'multipleCallback',
          '{$request.multipleExpression.queryUrl}',
          'post'
        ) as Callback;

        expect(callback.getSummary()).to.be.undefined;
        expect(callback.getDescription()).to.be.undefined;
      });

      it('should allow a common summary to override the callback-level summary', function () {
        const operation = callbackSchema.operation('/callbacks', 'get');
        const callback = operation.getCallback(
          'multipleCallback',
          '{$request.multipleMethod.queryUrl}',
          'post'
        ) as Callback;

        expect(callback.getSummary()).to.equal('[common] callback summary');
        expect(callback.getDescription()).to.equal('[common] callback description');
      });
    });
  });

  describe('#getContentType()', function () {
    it('should return the content type on an operation', function () {
      expect(petstore.operation('/pet', 'post').getContentType()).to.equal('application/json');
    });

    it('should prioritise json if it exists', function () {
      expect(
        new Operation(petstore.getDefinition(), '/body', 'get', {
          requestBody: {
            content: {
              'text/xml': {
                schema: {
                  type: 'string',
                  required: ['a'],
                  properties: {
                    a: {
                      type: 'string',
                    },
                  },
                },
                example: { a: 'value' },
              },
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['a'],
                  properties: {
                    a: {
                      type: 'string',
                    },
                  },
                },
                example: { a: 'value' },
              },
            },
          },
        }).getContentType()
      ).to.equal('application/json');
    });

    it('should fetch the type from the first requestBody if it is not JSON-like', function () {
      expect(
        new Operation(petstore.getDefinition(), '/body', 'get', {
          requestBody: {
            content: {
              'text/xml': {
                schema: {
                  type: 'object',
                  required: ['a'],
                  properties: {
                    a: {
                      type: 'string',
                    },
                  },
                },
                example: { a: 'value' },
              },
            },
          },
        }).getContentType()
      ).to.equal('text/xml');
    });

    it('should handle cases where the requestBody is a $ref', function () {
      const op = new Operation(
        Oas.init({
          ...petstore.getDefinition(),
          components: {
            requestBodies: {
              payload: {
                required: true,
                content: {
                  'multipart/form-data': {
                    schema: {
                      type: 'object',
                      properties: {
                        'Document file': {
                          type: 'string',
                          format: 'binary',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        }).getDefinition(),
        '/body',
        'post',
        {
          requestBody: {
            $ref: '#/components/requestBodies/payload',
          },
        }
      );

      expect(op.getContentType()).to.equal('multipart/form-data');
    });
  });

  describe('#isFormUrlEncoded()', function () {
    it('should identify `application/x-www-form-urlencoded`', function () {
      const op = new Operation(petstore.getDefinition(), '/form-urlencoded', 'get', {
        requestBody: {
          content: {
            'application/x-www-form-urlencoded': {
              schema: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
            },
          },
        },
      });

      expect(op.getContentType()).to.equal('application/x-www-form-urlencoded');
      expect(op.isFormUrlEncoded()).to.be.true;
    });
  });

  describe('#isMultipart()', function () {
    it('should identify `multipart/form-data`', function () {
      const op = new Operation(petstore.getDefinition(), '/multipart', 'get', {
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  documentFile: {
                    type: 'string',
                    format: 'binary',
                  },
                },
              },
            },
          },
        },
      });

      expect(op.getContentType()).to.equal('multipart/form-data');
      expect(op.isMultipart()).to.be.true;
    });
  });

  describe('#isJson()', function () {
    it('should identify `application/json`', function () {
      const op = new Operation(petstore.getDefinition(), '/json', 'get', {
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
            },
          },
        },
      });

      expect(op.getContentType()).to.equal('application/json');
      expect(op.isJson()).to.be.true;
    });
  });

  describe('#isXml()', function () {
    it('should identify `application/xml`', function () {
      const op = new Operation(petstore.getDefinition(), '/xml', 'get', {
        requestBody: {
          content: {
            'application/xml': {
              schema: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
            },
          },
        },
      });

      expect(op.getContentType()).to.equal('application/xml');
      expect(op.isXml()).to.be.true;
    });
  });

  describe('#getSecurity()', function () {
    const security = [{ auth: [] }];
    const securitySchemes = {
      auth: {
        type: 'http',
        scheme: 'basic',
      },
    };

    it('should return the security on this operation', function () {
      expect(
        Oas.init({
          openapi: '3.0.0',
          info: { title: 'testing', version: '1.0' },
          paths: {
            '/things': {
              post: {
                security,
                responses: {
                  200: {
                    description: 'ok',
                  },
                },
              },
            },
          },
          components: {
            securitySchemes,
          },
        })
          .operation('/things', 'post')
          .getSecurity()
      ).to.deep.equal(security);
    });

    it('should fallback to global security', function () {
      expect(
        Oas.init({
          openapi: '3.0.0',
          info: { title: 'testing', version: '1.0' },
          paths: {
            '/things': {
              post: {
                responses: {
                  200: {
                    description: 'ok',
                  },
                },
              },
            },
          },
          security,
          components: {
            securitySchemes,
          },
        })
          .operation('/things', 'post')
          .getSecurity()
      ).to.deep.equal(security);
    });

    it('should default to empty array if no security object defined', function () {
      expect(
        Oas.init({
          openapi: '3.0.0',
          info: { title: 'testing', version: '1.0' },
          paths: {
            '/things': {
              post: {
                responses: {
                  200: {
                    description: 'ok',
                  },
                },
              },
            },
          },
        })
          .operation('/things', 'post')
          .getSecurity()
      ).to.have.lengthOf(0);
    });

    it('should default to empty array if no `securitySchemes` are defined', function () {
      expect(
        Oas.init({
          openapi: '3.0.0',
          info: { title: 'testing', version: '1.0' },
          paths: {
            '/things': {
              post: {
                security,
                responses: {
                  200: {
                    description: 'ok',
                  },
                },
              },
            },
          },
          components: {},
        })
          .operation('/things', 'post')
          .getSecurity()
      ).to.have.lengthOf(0);
    });

    it('should default to empty array if an empty `securitySchemes` object is defined', function () {
      expect(
        Oas.init({
          openapi: '3.1.0',
          info: { title: 'testing', version: '1.0' },
          paths: {
            '/things': {
              post: {
                security,
              },
            },
          },
          components: {
            securitySchemes: {},
          },
        })
          .operation('/things', 'post')
          .getSecurity()
      ).to.have.lengthOf(0);
    });
  });

  describe('#getSecurityWithTypes()', function () {
    const security = [{ auth: [], invalid: [] }];
    const securitySchemes = {
      auth: {
        type: 'http',
        scheme: 'basic',
      },
    };
    const securitiesWithTypes = [
      [
        {
          security: {
            _key: 'auth',
            scheme: 'basic',
            type: 'http',
          },
          type: 'Basic',
        },
        false,
      ],
    ];

    const filteredSecuritiesWithTypes = [
      [
        {
          security: {
            _key: 'auth',
            scheme: 'basic',
            type: 'http',
          },
          type: 'Basic',
        },
      ],
    ];

    it('should return the array of securities on this operation', function () {
      expect(
        Oas.init({
          openapi: '3.0.0',
          info: { title: 'testing', version: '1.0' },
          paths: {
            '/things': {
              post: {
                security,
                responses: {
                  200: {
                    description: 'ok',
                  },
                },
              },
            },
          },
          components: {
            securitySchemes,
          },
        })
          .operation('/things', 'post')
          .getSecurityWithTypes()
      ).to.deep.equal(securitiesWithTypes);
    });

    it('should return the filtered array if filter flag is set to true', function () {
      expect(
        Oas.init({
          openapi: '3.0.0',
          info: { title: 'testing', version: '1.0' },
          paths: {
            '/things': {
              post: {
                security,
                responses: {
                  200: {
                    description: 'ok',
                  },
                },
              },
            },
          },
          components: {
            securitySchemes,
          },
        })
          .operation('/things', 'post')
          .getSecurityWithTypes(true)
      ).to.deep.equal(filteredSecuritiesWithTypes);
    });

    it('should fallback to global security', function () {
      expect(
        Oas.init({
          openapi: '3.0.0',
          info: { title: 'testing', version: '1.0' },
          paths: {
            '/things': {
              post: {
                responses: {
                  200: {
                    description: 'ok',
                  },
                },
              },
            },
          },
          security,
          components: {
            securitySchemes,
          },
        })
          .operation('/things', 'post')
          .getSecurityWithTypes()
      ).to.deep.equal(securitiesWithTypes);
    });

    it('should default to empty array if no security object defined', function () {
      expect(
        Oas.init({
          openapi: '3.0.0',
          info: { title: 'testing', version: '1.0' },
          paths: {
            '/things': {
              post: {
                responses: {
                  200: {
                    description: 'ok',
                  },
                },
              },
            },
          },
        })
          .operation('/things', 'post')
          .getSecurityWithTypes()
      ).to.have.lengthOf(0);
    });

    it('should default to empty array if no `securitySchemes` are defined', function () {
      expect(
        Oas.init({
          openapi: '3.0.0',
          info: { title: 'testing', version: '1.0' },
          paths: {
            '/things': {
              post: {
                security,
                responses: {
                  200: {
                    description: 'ok',
                  },
                },
              },
            },
          },
          components: {},
        })
          .operation('/things', 'post')
          .getSecurityWithTypes()
      ).to.have.lengthOf(0);
    });

    it('should not pollute the original OAS with a `_key` property in the security scheme', async function () {
      const spec = Oas.init({
        openapi: '3.1.0',
        info: { title: 'testing', version: '1.0' },
        paths: {
          '/things': {
            get: {
              security: [
                {
                  api_key: [],
                },
              ],
            },
          },
        },
        components: {
          securitySchemes: {
            api_key: {
              type: 'apiKey',
              name: 'api_key',
              in: 'query',
            },
          },
        },
      });

      expect(spec.operation('/things', 'get').getSecurityWithTypes()).to.deep.equal([
        [
          {
            type: 'Query',
            security: { type: 'apiKey', name: 'api_key', in: 'query', _key: 'api_key' },
          },
        ],
      ]);

      expect(spec.api.components.securitySchemes.api_key).to.deep.equal({
        type: 'apiKey',
        name: 'api_key',
        in: 'query',
        // _key: 'api_key' // This property should not have been added to the original API doc.
      });

      // The original API doc should still be valid.
      await expect(spec.api).to.be.an.openapi('3.1.0');
    });
  });

  // https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md#securitySchemeObject
  describe('#prepareSecurity()', function () {
    const path = '/auth';
    const method = 'get';

    /**
     * @param schemes SecurtiySchemesObject to create a test API definition for.
     * @returns Instance of Oas.
     */
    function createSecurityOas(schemes: RMOAS.SecuritySchemesObject): Oas {
      // https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md#securityRequirementObject
      const security = Object.keys(schemes).map(scheme => {
        return { [scheme]: [] };
      });

      return Oas.init({
        openapi: '3.0.0',
        info: {
          title: 'testing',
          version: '1.0.0',
        },
        components: { securitySchemes: schemes },
        paths: {
          [path]: {
            [method]: {
              security,
              responses: {
                200: {
                  description: 'ok',
                },
              },
            },
          },
        },
      });
    }

    it('http/basic: should return with a type of Basic', function () {
      const oas = createSecurityOas({
        securityScheme: {
          type: 'http',
          scheme: 'basic',
        },
      });

      expect(oas.operation(path, method).prepareSecurity()).to.deep.equal({
        Basic: [{ scheme: 'basic', type: 'http', _key: 'securityScheme' }],
      });
    });

    it('http/bearer: should return with a type of Bearer', function () {
      const oas = createSecurityOas({
        securityScheme: {
          type: 'http',
          scheme: 'bearer',
        },
      });

      expect(oas.operation(path, method).prepareSecurity()).to.deep.equal({
        Bearer: [{ scheme: 'bearer', type: 'http', _key: 'securityScheme' }],
      });
    });

    it('apiKey/query: should return with a type of Query', function () {
      const oas = createSecurityOas({
        securityScheme: {
          type: 'apiKey',
          in: 'query',
          name: 'apiKey',
        },
      });

      expect(oas.operation(path, method).prepareSecurity()).to.deep.equal({
        Query: [{ type: 'apiKey', in: 'query', name: 'apiKey', _key: 'securityScheme' }],
      });
    });

    it('apiKey/header: should return with a type of Header', function () {
      const oas = createSecurityOas({
        securityScheme: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
        },
      });

      expect(oas.operation(path, method).prepareSecurity()).to.deep.equal({
        Header: [{ type: 'apiKey', in: 'header', name: 'x-api-key', _key: 'securityScheme' }],
      });
    });

    it('apiKey/cookie: should return with a type of Cookie', function () {
      const oas = createSecurityOas({
        securityScheme: {
          type: 'apiKey',
          in: 'cookie',
          name: 'api_key',
        },
      });

      expect(oas.operation(path, method).prepareSecurity()).to.deep.equal({
        Cookie: [{ type: 'apiKey', in: 'cookie', name: 'api_key', _key: 'securityScheme' }],
      });
    });

    it('should work for petstore', function () {
      const operation = petstore.operation('/pet', 'post');

      expect(operation.prepareSecurity()).toMatchSnapshot();
    });

    it('should work for multiple securities (||)', function () {
      const operation = multipleSecurities.operation('/or-security', 'post');

      expect(Object.keys(operation.prepareSecurity())).to.have.lengthOf(2);
    });

    it('should work for multiple securities (&&)', function () {
      const operation = multipleSecurities.operation('/and-security', 'post');

      expect(Object.keys(operation.prepareSecurity())).to.have.lengthOf(2);
    });

    it('should work for multiple securities (&& and ||)', function () {
      const operation = multipleSecurities.operation('/and-or-security', 'post');

      expect(operation.prepareSecurity().OAuth2).to.have.lengthOf(2);
      expect(operation.prepareSecurity().Header).to.have.lengthOf(1);
    });

    it('should dedupe securities in within an && and || situation', function () {
      const operation = multipleSecurities.operation('/multiple-combo-auths-duped', 'get');

      expect(operation.prepareSecurity().Bearer).to.have.lengthOf(1);
      expect(operation.prepareSecurity().Header).to.have.lengthOf(2);
    });

    it.skip('should set a `key` property');

    it.skip('should throw if attempting to use a non-existent scheme');

    it('should return empty object if no security', function () {
      const operation = multipleSecurities.operation('/no-auth', 'post');
      expect(Object.keys(operation.prepareSecurity())).to.have.lengthOf(0);
    });

    it('should return empty object if security scheme doesnt exist', function () {
      const operation = multipleSecurities.operation('/unknown-scheme', 'post');
      expect(Object.keys(operation.prepareSecurity())).to.have.lengthOf(0);
    });

    it('should return empty if security scheme type doesnt exist', function () {
      const operation = multipleSecurities.operation('/unknown-auth-type', 'post');
      expect(Object.keys(operation.prepareSecurity())).to.have.lengthOf(0);
    });
  });

  describe('#getHeaders()', function () {
    it('should return an object containing request headers if params exist', function () {
      const uri = 'http://petstore.swagger.io/v2/pet/1';
      const method = 'DELETE' as RMOAS.HttpMethods;

      const logOperation = petstore.findOperation(uri, method);
      const operation = new Operation(
        petstore.api,
        logOperation.url.path,
        logOperation.url.method,
        logOperation.operation
      );

      expect(operation.getHeaders()).to.deep.equal({
        request: ['Authorization', 'api_key'],
        response: [],
      });
    });

    it('should return an object containing content-type request header if media types exist in request body', function () {
      const uri = 'http://petstore.swagger.io/v2/pet';
      const method = 'POST' as RMOAS.HttpMethods;

      const logOperation = petstore.findOperation(uri, method);
      const operation = new Operation(
        petstore.api,
        logOperation.url.path,
        logOperation.url.method,
        logOperation.operation
      );

      expect(operation.getHeaders()).to.deep.equal({
        request: ['Authorization', 'Content-Type'],
        response: [],
      });
    });

    it('should return an object containing accept and content-type headers if media types exist in response', function () {
      const uri = 'http://petstore.swagger.io/v2/pet/findByStatus';
      const method = 'GET' as RMOAS.HttpMethods;

      const logOperation = petstore.findOperation(uri, method);
      const operation = new Operation(
        petstore.api,
        logOperation.url.path,
        logOperation.url.method,
        logOperation.operation
      );

      expect(operation.getHeaders()).to.deep.equal({
        request: ['Authorization', 'Accept'],
        response: ['Content-Type'],
      });
    });

    it('should return an object containing request headers if security exists', function () {
      const uri = 'http://example.com/multiple-combo-auths';
      const method = 'POST' as RMOAS.HttpMethods;

      const logOperation = multipleSecurities.findOperation(uri, method);
      const operation = new Operation(
        multipleSecurities.api,
        logOperation.url.path,
        logOperation.url.method,
        logOperation.operation
      );

      expect(operation.getHeaders()).to.deep.equal({
        request: ['testKey', 'Authorization'],
        response: [],
      });
    });

    it('should return a Cookie header if security is located in cookie scheme', function () {
      const uri = 'http://local-link.com/2.0/users/johnSmith';
      const method = 'GET' as RMOAS.HttpMethods;

      const logOperation = referenceSpec.findOperation(uri, method);
      const operation = new Operation(
        referenceSpec.api,
        logOperation.url.path,
        logOperation.url.method,
        logOperation.operation
      );

      expect(operation.getHeaders()).to.deep.equal({
        request: ['Authorization', 'Cookie', 'Accept'],
        response: ['Content-Type'],
      });
    });

    describe.skip('authorization headers', function () {
      // it.each([
      //   ['HTTP Basic', '/anything/basic', 'post'],
      //   ['HTTP Bearer', '/anything/bearer', 'post'],
      //   ['OAuth2', '/anything/oauth2', 'post'],
      // ])('should find an authorization header for a %s request', (_, path, method) => {
      //   const operation = securities.operation(path, method as RMOAS.HttpMethods);
      //   const headers = operation.getHeaders();
      //   expect(headers.request).toContain('Authorization');
      // });
    });

    it('should target parameter refs and return names if applicable', function () {
      const uri = 'http://local-link.com/2.0/repositories/janeDoe/oas/pullrequests';
      const method = 'GET' as RMOAS.HttpMethods;

      const logOperation = referenceSpec.findOperation(uri, method);
      const operation = new Operation(
        referenceSpec.api,
        logOperation.url.path,
        logOperation.url.method,
        logOperation.operation
      );

      expect(operation.getHeaders()).to.deep.equal({
        request: ['hostname', 'Accept'],
        response: ['Content-Type'],
      });
    });

    it('should not fail if there are no responses', function () {
      const uri = 'http://petstore.swagger.io/v2/pet/1';
      const method: RMOAS.HttpMethods = 'delete';

      const logOperation = oas31NoResponses.findOperation(uri, method);
      const operation = new Operation(
        oas31NoResponses.api,
        logOperation.url.path,
        logOperation.url.method,
        logOperation.operation
      );

      expect(operation.getHeaders()).to.deep.equal({
        request: ['Authorization', 'api_key'],
        response: [],
      });
    });
  });

  describe('#hasOperationId()', function () {
    it('should return true if one exists', function () {
      const operation = petstore.operation('/pet/{petId}', 'delete');
      expect(operation.hasOperationId()).to.be.true;
    });

    it('should return false if one does not exist', function () {
      const operation = multipleSecurities.operation('/multiple-combo-auths-duped', 'get');
      expect(operation.hasOperationId()).to.be.false;
    });

    it("should return false if one is present but it's empty", function () {
      const spec = Oas.init({
        openapi: '3.1.0',
        info: {
          title: 'testing',
          version: '1.0.0',
        },
        paths: {
          '/anything': {
            get: {
              operationId: '',
            },
          },
        },
      });

      const operation = spec.operation('/anything', 'get');

      expect(operation.hasOperationId()).to.be.false;
    });
  });

  describe('#getOperationId()', function () {
    it('should return an operation id if one exists', function () {
      const operation = petstore.operation('/pet/{petId}', 'delete');
      expect(operation.getOperationId()).to.equal('deletePet');
    });

    it('should create one if one does not exist', function () {
      const operation = multipleSecurities.operation('/multiple-combo-auths-duped', 'get');
      expect(operation.getOperationId()).to.equal('get_multiple-combo-auths-duped');
    });

    describe('`camelCase` option', function () {
      it('should create a camel cased operation ID if one does not exist', function () {
        const operation = multipleSecurities.operation('/multiple-combo-auths-duped', 'get');
        expect(operation.getOperationId({ camelCase: true })).to.equal('getMultipleComboAuthsDuped');
      });

      it("should not touch an operationId that doesn't need to be camelCased", function () {
        const spec = Oas.init({
          openapi: '3.1.0',
          info: {
            title: 'testing',
            version: '1.0.0',
          },
          paths: {
            '/anything': {
              get: {
                // This operationID is already fine to use as a JS method accessor so we shouldn't do
                // anything to it.
                operationId: 'ExchangeRESTAPI_GetAccounts',
              },
            },
          },
        });

        const operation = spec.operation('/anything', 'get');
        expect(operation.getOperationId({ camelCase: true })).to.equal('ExchangeRESTAPI_GetAccounts');
      });

      it('should clean up an operationId that has non-alphanumeric characters', function () {
        const spec = Oas.init({
          openapi: '3.1.0',
          info: {
            title: 'testing',
            version: '1.0.0',
          },
          paths: {
            '/pet/findByStatus': {
              get: {
                // This mess of a string is intentionally nasty so we can be sure that we're not
                // including anything that wouldn't look right as an operationID for a potential
                // method accessor in `api`.
                operationId: 'find/?*!@#$%^&*()-=.,<>+[]{}\\|pets-by-status',
              },
            },
          },
        });

        const operation = spec.operation('/pet/findByStatus', 'get');
        expect(operation.getOperationId({ camelCase: true })).to.equal('findPetsByStatus');
      });

      it('should not double up on a method prefix if the path starts with the method', function () {
        const spec = Oas.init({
          openapi: '3.0.0',
          info: {
            title: 'testing',
            version: '1.0.0',
          },
          paths: {
            '/get-pets': {
              get: {
                tags: ['dogs'],
                responses: {
                  200: {
                    description: 'OK',
                  },
                },
              },
            },
          },
        });

        const operation = spec.operation('/get-pets', 'get');
        expect(operation.getOperationId({ camelCase: true })).to.equal('getPets');
      });
    });
  });

  describe('#getTags()', function () {
    it('should return tags if tags exist', function () {
      const operation = petstore.operation('/pet', 'post');

      expect(operation.getTags()).to.deep.equal([
        {
          name: 'pet',
          description: 'Everything about your Pets',
          externalDocs: { description: 'Find out more', url: 'http://swagger.io' },
        },
      ]);
    });

    it("should not return any tag metadata with the tag if it isn't defined at the OAS level", function () {
      const spec = Oas.init({
        openapi: '3.0.0',
        info: {
          title: 'testing',
          version: '1.0.0',
        },
        paths: {
          '/': {
            get: {
              tags: ['dogs'],
              responses: {
                200: {
                  description: 'OK',
                },
              },
            },
          },
        },
      });

      const operation = spec.operation('/', 'get');
      expect(operation.getTags()).to.deep.equal([{ name: 'dogs' }]);
    });

    it('should return an empty array if no tags are present', function () {
      const spec = Oas.init({
        openapi: '3.0.0',
        info: { title: 'testing', version: '1.0.0' },
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

      const operation = spec.operation('/', 'get');
      expect(operation.getTags()).to.have.lengthOf(0);
    });
  });

  describe('#isDeprecated()', function () {
    it('should return deprecated flag if present', function () {
      const operation = deprecatedSchema.operation('/anything', 'post');
      expect(operation.isDeprecated()).to.be.true;
    });

    it('should return false if no deprecated flag is present', function () {
      const operation = petstore.operation('/pet/{petId}', 'delete');
      expect(operation.isDeprecated()).to.be.false;
    });
  });

  describe('#hasParameters()', function () {
    it('should return true on an operation with parameters', function () {
      const operation = petstore.operation('/pet/{petId}', 'delete');
      expect(operation.hasParameters()).to.be.true;
    });

    it('should return false on an operation without any parameters', function () {
      const operation = petstore.operation('/pet', 'put');
      expect(operation.hasParameters()).to.be.false;
    });

    describe('callbacks', function () {
      it('should return parameters', function () {
        const operation = callbackSchema.operation('/callbacks', 'get');
        const callback = operation.getCallback(
          'multipleCallback',
          '{$request.multipleMethod.queryUrl}',
          'post'
        ) as Callback;

        expect(callback.hasParameters()).to.be.true;
      });

      it('should return an empty array if there are none', function () {
        const operation = callbackSchema.operation('/callbacks', 'get');
        const callback = operation.getCallback(
          'multipleCallback',
          '{$request.multipleExpression.queryUrl}',
          'post'
        ) as Callback;

        expect(callback.hasParameters()).to.be.false;
      });
    });
  });

  describe('#getParameters()', function () {
    it('should return parameters', function () {
      const operation = petstore.operation('/pet/{petId}', 'delete');
      expect(operation.getParameters()).to.have.lengthOf(2);
    });

    it('should support retrieving common parameters', function () {
      const operation = parametersCommon.operation('/anything/{id}', 'post');
      expect(operation.getParameters()).to.have.lengthOf(3);
    });

    it('should return an empty array if there are none', function () {
      const operation = petstore.operation('/pet', 'put');
      expect(operation.getParameters()).to.have.lengthOf(0);
    });

    describe('callbacks', function () {
      it('should return parameters', function () {
        const operation = callbackSchema.operation('/callbacks', 'get');
        const callback = operation.getCallback(
          'multipleCallback',
          '{$request.multipleMethod.queryUrl}',
          'post'
        ) as Callback;

        expect(callback.getParameters()).to.have.lengthOf(1);
      });

      it('should support retrieving common parameters', function () {
        const operation = callbackSchema.operation('/callbacks', 'get');
        const callback = operation.getCallback(
          'multipleCallback',
          '{$request.multipleMethod.queryUrl}',
          'get'
        ) as Callback;

        expect(callback.getParameters()).to.have.lengthOf(2);
      });

      it('should return an empty array if there are none', function () {
        const operation = callbackSchema.operation('/callbacks', 'get');
        const callback = operation.getCallback(
          'multipleCallback',
          '{$request.multipleExpression.queryUrl}',
          'post'
        ) as Callback;

        expect(callback.getParameters()).to.have.lengthOf(0);
      });
    });
  });

  describe('#hasRequiredParameters()', function () {
    it('should return true if some parameters are required', function () {
      expect(readme.operation('/api-specification', 'get').hasRequiredParameters()).to.be.false;
    });

    it('should return false if there are no parameters', function () {
      expect(petstore.operation('/store/inventory', 'get').hasRequiredParameters()).to.be.false;
    });
  });

  describe('#getParametersAsJsonSchema()', function () {
    it('should return json schema', function () {
      const operation = petstore.operation('/pet', 'put');
      expect(operation.getParametersAsJsonSchema()).toMatchSnapshot();
    });
  });

  describe('#hasRequestBody()', function () {
    it('should return true on an operation with a requestBody', function () {
      const operation = petstore.operation('/pet', 'put');
      expect(operation.hasRequestBody()).to.be.true;
    });

    it('should return false on an operation without a requestBody', function () {
      const operation = petstore.operation('/pet/findByStatus', 'get');
      expect(operation.hasRequestBody()).to.be.false;
    });
  });

  describe('#getRequestBodyMediaTypes()', function () {
    it('should return an empty array if no requestBody is present', function () {
      const operation = petstoreNondereferenced.operation('/pet/findByStatus', 'get');
      expect(operation.getRequestBodyMediaTypes()).to.have.lengthOf(0);
    });

    it('should return false on an operation with a non-dereferenced requestBody $ref pointer', function () {
      const operation = petstoreNondereferenced.operation('/anything', 'post');
      expect(operation.getRequestBodyMediaTypes()).to.have.lengthOf(0);
    });

    it('should return the available requestBody media types', function () {
      const operation = petstore.operation('/pet', 'put');
      expect(operation.getRequestBodyMediaTypes()).to.deep.equal(['application/json', 'application/xml']);
    });
  });

  describe('#hasRequiredRequestBody()', function () {
    it('should return true on an operation with a required requestBody', function () {
      const operation = petstore.operation('/pet', 'put');
      expect(operation.hasRequiredRequestBody()).to.be.true;
    });

    it('should return true on an optional requestBody payload that required schemas', function () {
      const operation = new Operation(petstore.getDefinition(), '/anything', 'post', {
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['a'],
                properties: {
                  a: {
                    type: 'string',
                  },
                },
              },
            },
          },
        },
      });

      expect(operation.hasRequiredRequestBody()).to.be.true;
    });

    it('should return true on an optional `application/x-www-form-urlencoded` requestBody payload that required schemas', function () {
      const operation = new Operation(petstore.getDefinition(), '/anything', 'post', {
        requestBody: {
          required: false,
          content: {
            'application/x-www-form-urlencoded': {
              schema: {
                type: 'object',
                required: ['a'],
                properties: {
                  a: {
                    type: 'string',
                  },
                },
              },
            },
          },
        },
      });

      expect(operation.hasRequiredRequestBody()).to.be.true;
    });

    it('should return false on an operation without a requestBody', function () {
      const operation = petstore.operation('/pet/findByStatus', 'get');
      expect(operation.hasRequiredRequestBody()).to.be.false;
    });

    it('should return false on an operation with a requestBody that is still a $ref', function () {
      const operation = petstoreNondereferenced.operation('/anything', 'post');
      expect(operation.hasRequiredRequestBody()).to.be.false;
    });
  });

  describe('#getRequestBody()', function () {
    it('should return false on an operation without a requestBody', function () {
      const operation = petstore.operation('/pet/findByStatus', 'get');
      expect(operation.getRequestBody('application/json')).to.be.false;
    });

    it('should return false on an operation without the specified requestBody media type', function () {
      const operation = petstore.operation('/pet', 'put');
      expect(operation.getRequestBody('text/xml')).to.be.false;
    });

    it('should return false on an operation with a non-dereferenced requestBody $ref pointer', function () {
      const operation = petstoreNondereferenced.operation('/anything', 'post');
      expect(operation.getRequestBody('application/json')).to.be.false;
    });

    it('should return the specified requestBody media type', function () {
      const operation = petstore.operation('/pet', 'put');

      expect(operation.getRequestBody('application/json')).toMatchSnapshot();
    });

    describe('should support retrieval without a given media type', function () {
      it('should prefer `application/json` media types', function () {
        const operation = petstore.operation('/pet', 'put');
        const res = operation.getRequestBody();

        expect(res).to.have.lengthOf(2);
        expect(res[0]).to.equal('application/json');
        expect(res[1]).to.have.property('schema').and.be.a('object');
      });

      it('should pick first available if no json-like media types present', function () {
        const operation = petstore.operation('/pet/{petId}', 'post');
        const res = operation.getRequestBody();

        expect(res).to.have.lengthOf(2);
        expect(res[0]).to.equal('application/x-www-form-urlencoded');
        expect(res[1]).to.have.property('schema').and.be.a('object');
      });
    });
  });

  describe('#getResponseByStatusCode()', function () {
    it('should return false if the status code doesnt exist', function () {
      const operation = petstore.operation('/pet/findByStatus', 'get');
      expect(operation.getResponseByStatusCode(202)).to.be.false;
    });

    it('should return the response', function () {
      const operation = petstore.operation('/pet/findByStatus', 'get');
      expect(operation.getResponseByStatusCode(200)).toMatchSnapshot();
    });
  });

  describe('#getResponseStatusCodes()', function () {
    it('should return all valid status codes for a response', function () {
      const operation = petstore.operation('/pet/findByStatus', 'get');
      expect(operation.getResponseStatusCodes()).to.deep.equal(['200', '400']);
    });

    it('should return an empty array if there are no responses', function () {
      const operation = petstore.operation('/pet/findByStatus', 'doesnotexist' as RMOAS.HttpMethods);
      expect(operation.getResponseStatusCodes()).to.have.lengthOf(0);
    });
  });

  describe('#hasCallbacks()', function () {
    it('should return true on an operation with callbacks', function () {
      const operation = callbackSchema.operation('/callbacks', 'get');
      expect(operation.hasCallbacks()).to.be.true;
    });

    it('should return false on an operation without callbacks', function () {
      const operation = petstore.operation('/pet/findByStatus', 'get');
      expect(operation.hasCallbacks()).to.be.false;
    });
  });

  describe('#getCallback()', function () {
    it('should return an operation from a callback if it exists', function () {
      const operation = callbackSchema.operation('/callbacks', 'get');
      const callback = operation.getCallback(
        'multipleCallback',
        '{$request.multipleMethod.queryUrl}',
        'post'
      ) as Callback;

      expect(callback.identifier).to.equal('multipleCallback');
      expect(callback.method).to.equal('post');
      expect(callback.path).to.equal('{$request.multipleMethod.queryUrl}');
      expect(callback).to.be.an.instanceOf(Callback);
      expect(callback.parentSchema).toMatchSnapshot();
    });

    it('should return false if that callback doesnt exist', function () {
      const operation = callbackSchema.operation('/callbacks', 'get');
      expect(operation.getCallback('fakeCallback', 'doesntExist', 'get')).to.be.false;
    });
  });

  describe('#getCallbacks()', function () {
    it('should return an array of operations created from each callback', function () {
      const operation = callbackSchema.operation('/callbacks', 'get');
      const callbacks = operation.getCallbacks() as Callback[];
      expect(callbacks).to.have.lengthOf(4);
      callbacks.forEach(callback => expect(callback).to.be.an.instanceOf(Callback));
    });

    it('should return false if theres no callbacks', function () {
      const operation = petstore.operation('/pet', 'put');
      expect(operation.getCallbacks()).to.be.false;
    });

    it("should return an empty object for the operation if only callbacks present aren't supported HTTP methods", function () {
      const oas = Oas.init({
        openapi: '3.1.0',
        info: {
          version: '1.0.0',
          title: 'operation with just common param callbacks',
        },
        paths: {
          '/anything': {
            post: {
              callbacks: {
                batchSuccess: {
                  '{$url}': {
                    // Instead of `post`, `get`, etc being here we just have `summary` and since that
                    // isn't a valid HTTP method we don't have any usable callbacks here to pull back
                    // with `getCallbacks()`.
                    summary: 'Batch call webhook',
                  },
                },
              },
            },
          },
        },
      });

      expect(oas.operation('/anything', 'post').getCallbacks()).to.have.lengthOf(0);
    });
  });

  describe('#getCallbackExamples()', function () {
    it('should return an array of examples for each callback that has them', function () {
      const operation = callbackSchema.operation('/callbacks', 'get');
      expect(operation.getCallbackExamples()).to.have.lengthOf(3);
    });

    it('should an empty array if there are no callback examples', function () {
      const operation = petstore.operation('/pet', 'put');
      expect(operation.getCallbackExamples()).to.have.lengthOf(0);
    });
  });

  describe('#hasExtension()', function () {
    it('should return true if the extension exists', function () {
      const operation = petstore.operation('/pet', 'put');
      operation.schema['x-samples-languages'] = false;

      expect(operation.hasExtension('x-samples-languages')).to.be.true;
    });

    it("should return false if the extension doesn't exist", function () {
      const operation = deprecatedSchema.operation('/pet', 'put');
      expect(operation.hasExtension('x-readme')).to.be.false;
    });

    it('should not fail if the Operation  instance has no API definition', function () {
      const operation = Oas.init(undefined).operation('/pet', 'put');
      expect(operation.hasExtension('x-readme')).to.be.false;
    });
  });

  describe('#getExtension()', function () {
    it('should return the extension if it exists', function () {
      const oas = Oas.init({
        ...petstore.getDefinition(),
        'x-readme': {
          'samples-languages': ['js', 'python'],
        },
      });

      const operation = oas.operation('/pet', 'put');
      operation.schema['x-readme'] = {
        'samples-languages': ['php', 'go'],
      };

      expect(operation.getExtension('x-readme')).to.deep.equal({
        'samples-languages': ['php', 'go'],
      });
    });

    it("should return nothing if the extension doesn't exist", function () {
      const operation = deprecatedSchema.operation('/pet', 'put');
      expect(operation.getExtension('x-readme')).to.be.undefined;
    });

    it('should not fail if the Operation instance has no API definition', function () {
      const operation = Oas.init(undefined).operation('/pet', 'put');
      expect(operation.getExtension('x-readme')).to.be.undefined;
    });
  });
});
