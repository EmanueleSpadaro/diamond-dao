import { FacetCut, FacetCutAction, SelectorsObj } from "./diamond";


interface HashMapValue {
    facetAddress: string,
    action: FacetCutAction
}

/**
 * Creates a new instance of an object that complies with the HashMapValue interface for FacetCuts computations
 *
 * @param facetAddress Facet Address of the Key Selector 
 * @param action FacetCutAction of the Key Selector
 * @returns A new instance of an object that complies with the HashMapValue interface
 */
function hmv(facetAddress: string, action: FacetCutAction) {
    return { facetAddress: facetAddress, action: action };
}

export class FacetCutArray extends Array<FacetCut> {

    constructor(facetCuts: FacetCut[]) {
        super(...facetCuts);
    }
    /**
     * Returns an array of FacetCut needed to reach the desiredCuts state as if this FacetCutArray was
     * the current set of installed cuts in a diamond
     * @param desiredCuts The desired set of FacetCut that you want to obtain from this FacetCutArray
     */
    upgradeTo(desiredCuts: FacetCut[]): FacetCutArray {
        const toAddCuts = new Map<string, string[]>();
        const toReplaceCuts = new Map<string, string[]>();
        const toRemoveCuts = new Map<string, string[]>();
        //HashMap syntax: map[selector], returns the associated facetAddress
        const startingHashMap = new Map<string, HashMapValue>();
        const desiredHashMap = new Map<string, HashMapValue>();
        //HashMap syntax: map[selector],returns the desired action for the given selector
        const desiredAction = new Map<string, FacetCutAction>();

        //We fill the hashmaps with the respective values
        desiredCuts.forEach((cut) => {
            //We add each function selector entry to the desired selectors paired with the facetAddress
            for (const selector of cut.functionSelectors) {
                desiredHashMap.set(selector, hmv(cut.facetAddress, cut.action));
            }
        });
        this.forEach((cut) => {
            if (cut.action === FacetCutAction.Remove)
                return;
            //We add each function selector entry to the starting selectors paired with the facetAddress
            for (const selector of cut.functionSelectors) {
                startingHashMap.set(selector, hmv(cut.facetAddress, cut.action));
            }
        });

        //We proceed to evaluate the proper facet cut values (3 => 3.1-3.3)
        desiredHashMap.forEach((postValue: HashMapValue, selector: string) => {
            const preValue = startingHashMap.get(selector);
            //If the selector is to be added or replaced and was previously nonexistent or removed, we ADD
            if (postValue.action !== FacetCutAction.Remove && (preValue === undefined || preValue.action === FacetCutAction.Remove)) {
                const facetAdditions = toAddCuts.has(postValue.facetAddress) ? toAddCuts.get(postValue.facetAddress)! : [];
                facetAdditions.push(selector);
                toAddCuts.set(postValue.facetAddress, facetAdditions);
            } else if (postValue.action !== FacetCutAction.Remove) {
                //Case 3.2, evaluating only Replacement case
                if (postValue.facetAddress !== preValue?.facetAddress) {
                    const facetReplacements = toReplaceCuts.has(postValue.facetAddress) ? toReplaceCuts.get(postValue.facetAddress)! : [];
                    facetReplacements.push(selector);
                    toReplaceCuts.set(postValue.facetAddress, facetReplacements);
                }
            } else if (postValue.action === FacetCutAction.Remove && (preValue?.action === FacetCutAction.Add || preValue?.action === FacetCutAction.Replace)) {
                const facetRemovals = toRemoveCuts.has(postValue.facetAddress) ? toRemoveCuts.get(postValue.facetAddress)! : [];
                facetRemovals.push(selector);
                toRemoveCuts.set(preValue.facetAddress, facetRemovals);
            }
        });
        //(4)
        startingHashMap.forEach((preValue: HashMapValue, selector: string) => {
            const hasReferenceInDesiredState = desiredHashMap.has(selector);
            if (hasReferenceInDesiredState === undefined) {
                const facetRemovals = toRemoveCuts.has(preValue.facetAddress) ? toRemoveCuts.get(preValue.facetAddress)! : [];
                facetRemovals.push(selector);
                toRemoveCuts.set(preValue.facetAddress, facetRemovals);
            }
        });


        const computedFacetCuts: FacetCutArray = [] as unknown as FacetCutArray;

        toAddCuts.forEach((selectors: string[], facetAddress: string) => {
            computedFacetCuts.push({
                facetAddress: facetAddress,
                action: FacetCutAction.Add,
                functionSelectors: selectors as SelectorsObj
            })
        });
        toReplaceCuts.forEach((selectors: string[], facetAddress: string) => {
            computedFacetCuts.push({
                facetAddress: facetAddress,
                action: FacetCutAction.Replace,
                functionSelectors: selectors as SelectorsObj
            })
        });
        toRemoveCuts.forEach((selectors: string[], facetAddress: string) => {
            computedFacetCuts.push({
                facetAddress: facetAddress,
                action: FacetCutAction.Remove,
                functionSelectors: selectors as SelectorsObj
            })
        });
        return computedFacetCuts;
    }
}

