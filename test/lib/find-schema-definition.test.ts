import petstore from '@readme/oas-examples/3.0/json/petstore.json';
import { expect } from 'chai';

import findSchemaDefinition from '../../src/lib/find-schema-definition';

describe('findSchemaDefinition', function () {
  it('should return a definition for a given ref', function () {
    expect(findSchemaDefinition('#/components/schemas/Pet', petstore)).to.deep.equal(petstore.components.schemas.Pet);
  });

  it('should return a definition for a given ref that is escaped', function () {
    expect(
      findSchemaDefinition('#/components/schemas/Pet~1Error', {
        components: {
          schemas: {
            'Pet/Error': petstore.components.schemas.ApiResponse,
          },
        },
      })
    ).to.deep.equal(petstore.components.schemas.ApiResponse);
  });

  it('should return false for an empty ref', function () {
    expect(findSchemaDefinition('', {})).to.be.false;
  });

  it('should throw an error if there is an invalid ref', function () {
    expect(() => findSchemaDefinition('some-other-ref', {})).to.throw(/Could not find a definition for/);
  });

  it('should throw an error if there is a missing ref', function () {
    expect(() => findSchemaDefinition('#/components/schemas/user', {})).to.throw(/Could not find a definition for/);
  });

  it("should throw an error if an escaped ref isn't present its non-escaped format", function () {
    expect(() => {
      findSchemaDefinition('#/components/schemas/Pet~1Errore', {
        components: {
          schemas: {
            // This should be written in the schema as `Pet/Error`.
            'Pet~1Error': {},
          },
        },
      });
    }).to.throw(/Could not find a definition for/);
  });
});
