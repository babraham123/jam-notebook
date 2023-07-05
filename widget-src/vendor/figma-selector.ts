// This is a checkout of reiddraper/figma-selector at 0839cb87a6f46d3433f3f9c77720430a767494b2
// We should switch to that package once Reid releases it!

import {
  CssSelectorParser,
  Rule,
  RuleAttr,
  RulePseudo,
  RuleSet,
  Selector,
} from "css-selector-parser";

const { currentPage } = figma;

const nodeTypes = [
  "SLICE",
  "FRAME",
  "GROUP",
  "COMPONENT_SET",
  "COMPONENT",
  "INSTANCE",
  "BOOLEAN_OPERATION",
  "VECTOR",
  "STAR",
  "LINE",
  "ELLIPSE",
  "POLYGON",
  "RECTANGLE",
  "TEXT",
  "STICKY",
  "CONNECTOR",
  "SHAPE_WITH_TEXT",
  "CODE_BLOCK",
  "STAMP",
  "WIDGET",
  "EMBED",
  "LINK_UNFURL",
  "MEDIA",
  "SECTION",
  "HIGHLIGHT",
  "WASHI_TAPE",
] as const;

enum Search {
  ALL = "ALL", // includes self
  CHILDREN = "CHILDREN",
  DESCENDANTS = "DESCENDANTS",
}

export function parse(selector: string, rootNode?: BaseNode): SceneNode[] {
  if (rootNode === undefined) {
    rootNode = figma.currentPage;
  }
  const nodes = findSelection(rootNode, parseSelector(selector), Search.ALL);
  return nodes;
}

export function parseAndSelect(selector: string): number {
  const nodes = (currentPage.selection = parse(selector));
  return nodes.length;
}

type SceneNodeType = SceneNode["type"];

function parseNodeName(input: string): SceneNodeType[] {
  const nodeName = nodeTypes.find((validName) => validName === input);
  if (nodeName) {
    return [nodeName];
  } else {
    return [];
  }
}

export function parseSelector(selector: string): Selector {
  const parser = new CssSelectorParser();
  parser.registerNestingOperators(">");
  parser.registerSelectorPseudos("stuck");
  parser.registerNumericPseudos("nth-child");
  return parser.parse(selector);
}

function findSelection(
  node: BaseNode,
  selector: Selector,
  search: Search
): SceneNode[] {
  if (selector.type === "selectors") {
    return selector.selectors.reduce((acc: SceneNode[], ruleset: RuleSet) => {
      const nodes = findRuleset(node, ruleset, search);
      return acc.concat(nodes);
    }, [] as SceneNode[]);
  } else {
    return findRuleset(node, selector, search);
  }
}

function findRuleset(
  node: BaseNode,
  ruleset: RuleSet,
  search: Search
): SceneNode[] {
  return findRule(node, ruleset.rule, search);
}

function findRule(node: BaseNode, rule: Rule, search: Search): SceneNode[] {
  /*
    console.log(
      `find_rule: node: ${node.type} rule: ${JSON.stringify(
        rule
      )} search: ${search}`
    );
    */
  let candidates: SceneNode[] = [];
  if (rule.tagName) {
    let all_typed_nodes: SceneNode[] = [];
    const upperCaseTagName = rule.tagName.toUpperCase();

    // If our search is for Search.ALL,
    // consider the current node, and not
    // just its children or descendants
    if (
      search === Search.ALL &&
      node.type === upperCaseTagName &&
      parseNodeName(upperCaseTagName).length > 0
    ) {
      // NOTE: This cast is safe because we checked
      // that the node type is a SceneNode
      // above
      all_typed_nodes.push(node as SceneNode);
    }

    if (
      (search === Search.DESCENDANTS || search === Search.ALL) &&
      "findAllWithCriteria" in node
    ) {
      const typesafe_tag_name = parseNodeName(upperCaseTagName);
      const children_matching_tag = node.findAllWithCriteria({
        types: typesafe_tag_name,
      });
      all_typed_nodes = all_typed_nodes.concat(children_matching_tag);
    } else if (search === Search.CHILDREN && "children" in node) {
      for (const child of node.children) {
        if (child.type === upperCaseTagName) {
          all_typed_nodes.push(child as SceneNode);
        }
      }
    }
    const attr_filtered_nodes = all_typed_nodes.filter((node) =>
      matchesAttrs(node, rule)
    );
    candidates = candidates.concat(attr_filtered_nodes);
    candidates = matchAndFilterPseudos(candidates, rule);
  }
  if ("rule" in rule && rule.rule !== undefined) {
    const subRule = rule.rule;
    let oldCandidates = candidates;
    candidates = [];
    let searchType: Search = Search.DESCENDANTS; // default case
    if (subRule.nestingOperator === null) {
      searchType = Search.DESCENDANTS;
    }
    if (subRule.nestingOperator === ">") {
      searchType = Search.CHILDREN;
    }
    for (const subNode of oldCandidates) {
      const subCandidates = findRule(subNode, subRule, searchType);
      candidates = candidates.concat(subCandidates);
    }
  }
  return candidates;
}

const pseudoClassMap = new Map<
  string,
  (node: SceneNode[], pseudo: RulePseudo) => SceneNode[]
>();

pseudoClassMap.set("stuck", stuckPseudoClass);
pseudoClassMap.set("nth-child", nthChildPseudoClass);

function matchAndFilterPseudos(nodes: SceneNode[], rule: Rule): SceneNode[] {
  let results = nodes;
  if ("pseudos" in rule) {
    for (const pseudo of rule.pseudos) {
      const func = pseudoClassMap.get(pseudo.name);
      if (func) {
        results = func(results, pseudo);
      } else {
        console.log(`Unknown pseudo class: ${pseudo.name}`);
        return [];
      }
    }
  }
  return results;
}

function matchesAttrs(node: SceneNode, rule: Rule): boolean {
  // NOTE:
  // We have to do this because the Rule type
  // mistakenly has the attrs property as non-nullable,
  // when in reality it is nullable
  if ("attrs" in rule) {
    for (const attr of rule.attrs) {
      if (!matchesAttr(node, attr)) {
        return false;
      }
    }
  }
  return true;
}

function matchesAttr(node: SceneNode, attr: RuleAttr): boolean {
  if (attr.name === "name" && "value" in attr) {
    return attr.value === node.name;
  }
  if (attr.name === "author" && "value" in attr) {
    if (node.type === "STICKY") {
      return attr.value === node.authorName;
    } else {
      // Other node types don't have an author, so we don't match
      return false;
    }
  }
  // TODO: return false if unimplemented attributes are used
  return true;
}

function stuckPseudoClass(nodes: SceneNode[], pseudo: RulePseudo): SceneNode[] {
  const results: SceneNode[] = [];
  for (const node of nodes) {
    if (
      // do we need to keep this,
      // since the caller has already checked
      // this is the same string?
      pseudo.name === "stuck" &&
      "valueType" in pseudo &&
      pseudo.valueType === "selector" &&
      "stuckNodes" in node
    ) {
      let matching_nodes: SceneNode[] = [];
      for (const stuckNode of node.stuckNodes) {
        const result = findSelection(stuckNode, pseudo.value, Search.ALL);
        matching_nodes = matching_nodes.concat(result);
      }
      if (matching_nodes.length > 0) {
        results.push(node);
      }
    }
  }
  return results;
}

function pseudoStringValueType(pseudo: RulePseudo): string | null {
  if (pseudo.valueType === "numeric" || pseudo.valueType === "string") {
    return pseudo.valueType;
  } else {
    return null;
  }
}

// TODO: handle <An+B> functional notation
// https://developer.mozilla.org/en-US/docs/Web/CSS/:nth-child
function nthChildPseudoClass(
  nodes: SceneNode[],
  pseudo: RulePseudo
): SceneNode[] {
  const results: SceneNode[] = [];
  const pseudoValue = pseudoStringValueType(pseudo);
  if (pseudoValue !== null) {
    if (pseudo.value === "even") {
      return nodes.filter((node, index) => index % 2 === 0);
    }
    if (pseudo.value === "odd") {
      return nodes.filter((node, index) => index % 2 !== 0);
    }
    // Not part of the CSS spec, just a little fun
    // easter egg
    if (pseudo.value === "random") {
      const random_index = Math.floor(Math.random() * nodes.length);
      return [nodes[random_index]];
    }

    const asNumber = Number(pseudo.value);
    if (!isNaN(asNumber) && asNumber >= 0 && asNumber <= nodes.length) {
      return [nodes[asNumber - 1]];
    }
  }
  return results;
}
