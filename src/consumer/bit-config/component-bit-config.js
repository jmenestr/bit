/** @flow */
import R from 'ramda';
import fs from 'fs-extra';
import { InvalidBitJson } from './exceptions';
import AbstractBitConfig from './abstract-bit-config';
import type { Compilers, Testers } from './abstract-bit-config';
import type ConsumerBitConfig from './consumer-bit-config';
import type { PathOsBased } from '../../utils/path';
import type Component from '../component/consumer-component';

export type BitConfigProps = {
  lang?: string,
  compiler?: string | Compilers,
  tester?: string | Testers,
  bindingPrefix: string,
  extensions?: Object,
  overrides?: Object
};

export default class ComponentBitConfig extends AbstractBitConfig {
  overrides: ?Object;
  constructor({ compiler, tester, lang, bindingPrefix, extensions, overrides }: BitConfigProps) {
    super({
      compiler,
      tester,
      lang,
      bindingPrefix,
      extensions
    });
    this.overrides = overrides;
    this.writeToBitJson = true; // will be changed later to work similar to consumer-bit-config
  }

  toPlainObject() {
    const superObject = super.toPlainObject();
    return R.merge(superObject, {
      overrides: this.overrides
    });
  }

  toJson(readable: boolean = true) {
    if (!readable) return JSON.stringify(this.toPlainObject());
    return JSON.stringify(this.toPlainObject(), null, 4);
  }

  validate(bitJsonPath: string) {
    if (
      typeof this.compiler !== 'object' ||
      typeof this.tester !== 'object' ||
      (this.extensions() && typeof this.extensions() !== 'object')
    ) {
      throw new InvalidBitJson(bitJsonPath);
    }
  }

  static fromPlainObject(object: Object): ComponentBitConfig {
    const { env, lang, bindingPrefix, extensions, overrides } = object;

    return new ComponentBitConfig({
      compiler: R.prop('compiler', env),
      tester: R.prop('tester', env),
      extensions,
      lang,
      bindingPrefix,
      overrides
    });
  }

  static fromComponent(component: Component) {
    return new ComponentBitConfig({
      version: component.version,
      scope: component.scope,
      lang: component.lang,
      bindingPrefix: component.bindingPrefix,
      compiler: component.compiler || {},
      tester: component.tester || {}
    });
  }

  mergeWithComponentData(component: Component) {
    this.bindingPrefix = component.bindingPrefix;
    this.lang = component.lang;
  }

  /**
   * Use the consumerBitConfig as a base. Override values if exist in componentBitConfig
   */
  static mergeWithConsumerBitConfig(componentConfig: Object, consumerConfig: ?ConsumerBitConfig): ComponentBitConfig {
    const plainConsumerConfig = consumerConfig ? consumerConfig.toPlainObject() : {};
    return ComponentBitConfig.fromPlainObject(R.merge(plainConsumerConfig, componentConfig));
  }

  static async load(dirPath: string, consumerConfig: ConsumerBitConfig): Promise<ComponentBitConfig> {
    if (!dirPath) throw new TypeError('component-bit-config.load missing dirPath arg');
    let thisConfig = {};
    const bitJsonPath = AbstractBitConfig.composeBitJsonPath(dirPath);
    const fileExist = await fs.exists(bitJsonPath);
    if (fileExist) {
      try {
        thisConfig = await fs.readJson(bitJsonPath);
      } catch (e) {
        throw new InvalidBitJson(bitJsonPath);
      }
    }

    const componentBitConfig = ComponentBitConfig.mergeWithConsumerBitConfig(thisConfig, consumerConfig);
    componentBitConfig.path = bitJsonPath;
    return componentBitConfig;
  }

  getAllDependenciesOverrides() {
    if (!this.overrides) return {};
    return Object.assign(
      this.overrides.dependencies || {},
      this.overrides.devDependencies || {},
      this.overrides.peerDependencies
    );
  }
}
