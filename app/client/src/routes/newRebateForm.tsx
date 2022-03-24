import { useRef, useLayoutEffect } from "react";
import { modal } from "uswds/src/js/components";
import icons from "uswds/img/sprite.svg";
// ---
import { useUserState } from "contexts/user";

export default function NewRebateForm() {
  const { userData } = useUserState();

  const modalRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const modalEl = modalRef.current;
    if (!modalEl) return;

    modal.on(modalEl);

    return function cleanup() {
      modal.off(modalEl);
    };
  }, [modalRef]);

  if (userData.status !== "success") return null;

  return (
    <div className="margin-top-1 padding-2 bg-base-lightest">
      <button
        type="button"
        className="usa-button font-sans-2xs"
        aria-controls="csb-new-rebate-modal"
        data-open-modal
      >
        Select Record
      </button>

      <div ref={modalRef}>
        <div
          id="csb-new-rebate-modal"
          className="usa-modal usa-modal--lg"
          aria-labelledby="csb-new-rebate-modal-heading"
          aria-describedby="csb-new-rebate-modal-description"
          data-force-action
        >
          <div className="usa-modal__content">
            <div className="usa-modal__main">
              <h2
                id="csb-new-rebate-modal-heading"
                className="usa-modal__heading"
              >
                Start a new rebate application
              </h2>

              <div className="usa-prose">
                <p id="csb-new-rebate-modal-description">
                  Please select a record below to begin your new rebate
                  application.
                </p>
              </div>

              <table className="usa-table usa-table--borderless usa-table--striped width-full">
                <thead>
                  <tr>
                    <th scope="col">&nbsp;</th>
                    <th scope="col">UEI</th>
                    <th scope="col">EFT</th>
                    <th scope="col">CAGE</th>
                    <th scope="col">Entity Name</th>
                  </tr>
                </thead>
                <tbody>
                  {userData.data.samUserData.map((data, index) => {
                    const { uei, eft, cage, entityName } = data;
                    return (
                      <tr key={index}>
                        <th scope="row">
                          <button
                            type="button"
                            className="usa-button usa-button--base font-sans-2xs margin-right-0 padding-x-105 padding-y-1"
                            data-close-modal
                          >
                            <span className="display-flex flex-align-center">
                              <svg
                                className="usa-icon"
                                aria-hidden="true"
                                focusable="false"
                                role="img"
                              >
                                <use href={`${icons}#arrow_forward`} />
                              </svg>
                            </span>
                          </button>
                        </th>
                        <th>{uei}</th>
                        <th>{eft}</th>
                        <th>{cage}</th>
                        <th>{entityName}</th>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
