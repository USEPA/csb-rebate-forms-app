describe('Main', () => {
    beforeEach(() => {
        cy.visit('/');
    });

    it('Test', () => {
        cy.findByTestId('csb-sign-in-button');
    });
})