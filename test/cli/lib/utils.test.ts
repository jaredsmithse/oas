import chai, { expect } from 'chai';
import { jestSnapshotPlugin } from 'mocha-chai-jest-snapshot';

import utils from '../../../src/cli/lib/utils';

chai.use(jestSnapshotPlugin());

describe('CLI utils', function () {
  it.skip('#findSwagger');

  describe('#isJSONOrYaml', function () {
    it('should recognize `.json` as JSON', function () {
      expect(utils.isJSONOrYaml(require.resolve('@readme/oas-examples/3.0/json/petstore.json'))).to.be.true;
    });

    it('should recognize `.yaml` as YAML', function () {
      expect(utils.isJSONOrYaml(require.resolve('@readme/oas-examples/3.0/yaml/petstore.yaml'))).to.be.true;
    });

    it('should recognize `.yml` as YAML', function () {
      expect(utils.isJSONOrYaml(require.resolve('@readme/oas-examples/3.0/yaml/petstore.yaml'))).to.be.true;
    });

    it('should not recognize `.js` as JSON', function () {
      expect(utils.isJSONOrYaml('i-am-not-json.js')).to.be.false;
    });

    it('should not recognize `.y` as YAML', function () {
      expect(utils.isJSONOrYaml('i-am-not-yaml.y')).to.be.false;
    });
  });

  it.skip('#fileExists');

  it.skip('#guessLanguage');

  describe('#swaggerInlineExample', function () {
    // eslint-disable-next-line mocha/no-setup-in-describe
    ['coffee', 'go', 'java', 'js', 'jsx', 'php', 'py', 'rb', 'ts'].forEach(lang => {
      it(`should support \`.${lang}\``, function () {
        expect(utils.swaggerInlineExample(lang)).toMatchSnapshot();
      });
    });
  });
});
