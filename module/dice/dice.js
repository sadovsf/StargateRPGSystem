/**
 * A standardized helper function for simplifying the constant parts of a multipart roll formula
 *
 * @param {string} formula                 The original Roll formula
 * @param {Object} data                    Actor or item data against which to parse the roll
 * @param {Object} options                 Formatting options
 * @param {boolean} options.constantFirst   Puts the constants before the dice terms in the resulting formula
 *
 * @return {string}                        The resulting simplified formula
 */
 export function simplifyRollFormula(formula, data, {constantFirst = false} = {}) {
    const roll = new Roll(formula, data); // Parses the formula and replaces any @properties
    const terms = roll.terms;

    // Some terms are "too complicated" for this algorithm to simplify
    // In this case, the original formula is returned.
    if (terms.some(_isUnsupportedTerm)) return roll.formula;

    const rollableTerms = []; // Terms that are non-constant, and their associated operators
    const constantTerms = []; // Terms that are constant, and their associated operators
    let operators = [];       // Temporary storage for operators before they are moved to one of the above

    for (let term of terms) {                                 // For each term
      if (term instanceof OperatorTerm) operators.push(term); // If the term is an addition/subtraction operator, push the term into the operators array
      else {                                                  // Otherwise the term is not an operator
        if (term instanceof DiceTerm) {                       // If the term is something rollable
          rollableTerms.push(...operators);                   // Place all the operators into the rollableTerms array
          rollableTerms.push(term);                           // Then place this rollable term into it as well
        }                                                     //
        else {                                                // Otherwise, this must be a constant
          constantTerms.push(...operators);                   // Place the operators into the constantTerms array
          constantTerms.push(term);                           // Then also add this constant term to that array.
        }                                                     //
        operators = [];                                       // Finally, the operators have now all been assigend to one of the arrays, so empty this before the next iteration.
      }
    }

    const constantFormula = Roll.getFormula(constantTerms);  // Cleans up the constant terms and produces a new formula string
    const rollableFormula = Roll.getFormula(rollableTerms);  // Cleans up the non-constant terms and produces a new formula string

    // Mathematically evaluate the constant formula to produce a single constant term
    let constantPart = undefined;
    if ( constantFormula ) {
      try {
        constantPart = Roll.safeEval(constantFormula)
      } catch (err) {
        console.warn(`Unable to evaluate constant term ${constantFormula} in simplifyRollFormula`);
      }
    }

    // Order the rollable and constant terms, either constant first or second depending on the optional argument
    const parts = constantFirst ? [constantPart, rollableFormula] : [rollableFormula, constantPart];

    // Join the parts with a + sign, pass them to `Roll` once again to clean up the formula
    return new Roll(parts.filterJoin(" + ")).formula;
  }

  /**
 * Only some terms are supported by simplifyRollFormula, this method returns true when the term is not supported.
 * @param {*} term - A single Dice term to check support on
 * @return {Boolean} True when unsupported, false if supported
 */
function _isUnsupportedTerm(term) {
	const diceTerm = term instanceof DiceTerm;
	const operator = term instanceof OperatorTerm && ["+", "-"].includes(term.operator);
	const number   = term instanceof NumericTerm;

	return !(diceTerm || operator || number);
}