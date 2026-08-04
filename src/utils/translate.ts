type TEnglishDictionary = typeof import('../../public/locales/en.json');

type TKeyInFile = keyof TEnglishDictionary & string;

type TPluralBase<TKey extends string> = TKey extends `${infer TBase}_one`
  ? TBase
  : TKey extends `${infer TBase}_other`
    ? TBase
    : never;

export type TTranslationKey = TKeyInFile | TPluralBase<TKeyInFile>;

export type TTranslationValues = Record<string, string | number>;

export type TTranslate = (
  key: TTranslationKey,
  values?: TTranslationValues,
) => string;

export type TDictionary = Record<string, string>;

const resolve = (
  dictionary: TDictionary,
  key: string,
  values?: TTranslationValues,
) => {
  if (typeof values?.count === 'number') {
    const suffixed = `${key}_${values.count === 1 ? 'one' : 'other'}`;
    if (suffixed in dictionary) return dictionary[suffixed];

    if (`${key}_other` in dictionary) return dictionary[`${key}_other`];
  }

  return dictionary[key];
};

const interpolate = (template: string, values?: TTranslationValues) =>
  values
    ? template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
        name in values ? String(values[name]) : match,
      )
    : template;

export const createTranslate =
  (dictionary: TDictionary): TTranslate =>
  (key, values) => {
    const template = resolve(dictionary, key, values);

    if (template === undefined) return key;

    return interpolate(template, values);
  };
