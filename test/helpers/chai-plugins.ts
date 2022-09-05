/* eslint-disable no-underscore-dangle */
import openapiParser from '@readme/openapi-parser';
import chai from 'chai';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Chai {
    interface Assertion {
      /**
       * Assert that a given object is a valid OpenAPI definition and and contains a specific
       * `openapi` version property. fixture.
       *
       * @param version Version of OpenAPI that the given object is targeted towards.
       */
      openapi: (version: string) => void;
    }
  }
}

export default function chaiPlugins(_chai, utils) {
  utils.addMethod(chai.Assertion.prototype, 'openapi', async function (version: string) {
    const cloned = JSON.parse(JSON.stringify(this._obj));

    const spec = await openapiParser.validate(cloned);

    new chai.Assertion(spec).to.have.property('openapi').and.equal(version);
  });
}
