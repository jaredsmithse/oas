import swagger from '@readme/oas-examples/2.0/json/petstore.json';
import petstore from '@readme/oas-examples/3.0/json/petstore.json';
import uspto from '@readme/oas-examples/3.0/json/uspto.json';
import chai, { expect } from 'chai';
import { jestSnapshotPlugin } from 'mocha-chai-jest-snapshot';

import reducer from '../../src/lib/reducer';
import complexNesting from '../__datasets__/complex-nesting.json';
import parametersCommon from '../__datasets__/parameters-common.json';
import tagQuirks from '../__datasets__/tag-quirks.json';

chai.use(jestSnapshotPlugin());

describe('reducer', function () {
  it('it should not do anything if no reducers are supplied', function () {
    expect(reducer(petstore as any)).to.deep.equal(petstore as any);
  });

  it('should fail if given a Swagger 2.0 definition', function () {
    expect(() => {
      reducer(swagger as any);
    }).to.throw('Sorry, only OpenAPI 3.x definitions are supported.');
  });

  describe('tag reduction', function () {
    it('should reduce by tags', function () {
      const reduced = reducer(petstore as any, { tags: ['store'] });

      expect(reduced.tags).to.deep.equal([{ name: 'store', description: 'Access to Petstore orders' }]);

      expect(Object.keys(reduced.paths)).to.have.lengthOf(3);
      expect(reduced.paths).to.have.property('/store/inventory').and.have.property('get').and.be.a('object');
      expect(reduced.paths).to.have.property('/store/order').and.have.property('post').and.be.a('object');
      expect(reduced.paths).to.have.property('/store/order/{orderId}').and.have.property('get').and.be.a('object');
      expect(reduced.paths).to.have.property('/store/order/{orderId}').and.have.property('delete').and.be.a('object');

      expect(reduced.components).to.have.property('schemas').and.have.property('Order').and.be.a('object');
      expect(reduced.components).to.have.property('securitySchemes').and.have.property('api_key').and.be.a('object');
    });

    it('should support reducing by tags that are only stored at the operation level', function () {
      const reduced = reducer(tagQuirks as any, { tags: ['commerce'] });

      expect(reduced.tags).to.deep.equal([{ name: 'store', description: 'Access to Petstore orders' }]);

      expect(Object.keys(reduced.paths)).to.have.lengthOf(1);
      expect(reduced.paths).to.have.property('/store/inventory').and.have.property('get').and.be.a('object');
    });
  });

  describe('path reduction', function () {
    it('should reduce by paths', function () {
      const reduced = reducer(petstore as any, {
        paths: {
          '/store/order/{orderId}': ['get'],
        },
      });

      expect(reduced.tags).to.deep.equal([{ name: 'store', description: 'Access to Petstore orders' }]);

      expect(Object.keys(reduced.paths)).to.have.lengthOf(1);
      expect(reduced.paths).to.have.property('/store/order/{orderId}').and.have.property('get').and.be.a('object');

      expect(reduced.components).to.have.property('schemas').and.have.property('Order').and.be.a('object');
    });

    it('should support method wildcards', function () {
      const reduced = reducer(petstore as any, {
        paths: {
          '/store/order/{orderId}': '*',
        },
      });

      expect(Object.keys(reduced.paths['/store/order/{orderId}'])).to.have.lengthOf(2);
      expect(reduced.paths['/store/order/{orderId}']).to.have.property('get').and.be.a('object');
      expect(reduced.paths['/store/order/{orderId}']).to.have.property('delete').and.be.a('object');
    });

    it('should support reducing common parameters', function () {
      const reduced = reducer(parametersCommon as any, {
        paths: {
          '/anything/{id}': ['get'],
        },
      });

      expect(Object.keys(reduced.paths['/anything/{id}'])).to.have.lengthOf(2);
      expect(reduced.paths['/anything/{id}']).to.have.property('parameters').and.be.a('array');
      expect(reduced.paths['/anything/{id}']).to.have.property('get').and.be.a('object');
    });
  });

  it('should support retaining deeply nested used $ref pointers', function () {
    const reduced = reducer(complexNesting as any, { paths: { '/multischema/of-everything': '*' } });

    expect(reduced.components).toMatchSnapshot();
  });

  it("it should not leave any components if there aren't any in use", function () {
    const reduced = reducer(uspto as any, { paths: { '/{dataset}/{version}/records': '*' } });

    expect(reduced.components).to.be.undefined;
  });

  it('should throw an error if we end up with a definition that has no paths', function () {
    expect(() => {
      reducer(petstore as any, { tags: ['unknownTag'] });
    }).to.throw('All paths in the API definition were removed. Did you supply the right path name to reduce by?');

    expect(() => {
      reducer(petstore as any, { paths: { '/unknownPath': '*' } });
    }).to.throw('All paths in the API definition were removed. Did you supply the right path name to reduce by?');
  });
});
