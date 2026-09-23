(() => {
  "use strict";

  const ALLOCATION_POINTS = {
    2: {
      1: 0.5,
      2: 1,
      3: 1.5,
      4: 2
    },
    4: {
      1: 1,
      2: 2,
      3: 3,
      4: 4
    },
    6: {
      1: 1.5,
      2: 3,
      3: 4.5,
      4: 6
    }
  };

  const PERF_F = [
    306, 299, 292, 285, 278, 272,
    266, 260, 254, 248, 242, 236,
    230, 225, 220, 215, 210, 205,
    200, 195, 190, 185, 180, 175
  ];

  const PERF_M = [
    242, 237, 232, 227, 222, 217,
    212, 207, 202, 197, 192, 188,
    184, 180, 176, 172, 168, 165,
    162, 159, 156, 153, 150, 147
  ];

  function laps200(splits) {
    if (
      !Array.isArray(splits) ||
      splits.length < 4
    ) {
      return [];
    }

    const values =
      splits
        .slice(0, 4)
        .map(Number);

    if (
      values.some(
        value =>
          !Number.isFinite(value)
      )
    ) {
      return [];
    }

    return values.map(
      (value, index) =>
        index === 0
          ? value
          : value -
            values[index - 1]
    );
  }

  function perf(sec, sex) {
    const scale =
      String(
        sex || ""
      ).toUpperCase() === "M"
        ? PERF_M
        : PERF_F;

    let points = 0;

    scale.forEach(
      (threshold, index) => {
        if (sec <= threshold) {
          points =
            (index + 1) *
            0.25;
        }
      }
    );

    return Math.min(
      6,
      points
    );
  }

  function efficiency(ms) {
    if (
      !Number.isFinite(
        Number(ms)
      )
    ) {
      return 0;
    }

    const seconds =
      Number(ms) /
      1000;

    if (seconds >= 21) return 0;
    if (seconds >= 20) return 0.5;
    if (seconds >= 18) return 1;
    if (seconds >= 16) return 1.5;
    if (seconds >= 14) return 2;
    if (seconds >= 12) return 2.5;
    if (seconds >= 10) return 3;
    if (seconds >= 9) return 3.5;
    if (seconds >= 8) return 4;
    if (seconds >= 7) return 4.5;
    if (seconds >= 6) return 5;
    if (seconds >= 5) return 5.5;
    if (seconds < 4) return 6;

    return 5.5;
  }

  function scoreCCF(student) {
    const r1 =
      student?.races?.[1];

    const r2 =
      student?.races?.[2];

    if (
      !r1 ||
      !r2
    ) {
      return null;
    }

    const laps1 =
      laps200(r1.splits);

    const laps2 =
      laps200(r2.splits);

    if (
      laps1.length !== 4 ||
      laps2.length !== 4
    ) {
      return null;
    }

    const t1 =
      Number(r1.totalMs);

    const t2 =
      Number(r2.totalMs);

    if (
      !Number.isFinite(t1) ||
      !Number.isFinite(t2)
    ) {
      return null;
    }

    const all =
      [
        ...laps1,
        ...laps2
      ];

    const best =
      Math.min(
        t1,
        t2
      );

    const fastest200 =
      Math.min(...all);

    const slowest200 =
      Math.max(...all);

    const spread =
      slowest200 -
      fastest200;

    const pp =
      perf(
        best / 1000,
        student.sex
      );

    const rp =
      efficiency(
        spread
      );

    return {
      best,
      fastest200,
      slowest200,
      spread,
      pp,
      rp,
      total:
        pp + rp,
      laps1,
      laps2
    };
  }

  function allocation(student) {
    const allowed = [
      "2-6",
      "4-4",
      "6-2"
    ];

    const key =
      allowed.includes(
        student.aflAllocation
      )
        ? student.aflAllocation
        : "4-4";

    const [
      a2,
      a3
    ] =
      key
        .split("-")
        .map(Number);

    return {
      key,
      a2,
      a3
    };
  }

  function levelPoints(
    max,
    level
  ) {
    return (
      ALLOCATION_POINTS[max]
        ?.[Number(level)] ??
      null
    );
  }

  function parseProject(value) {
    if (
      value == null ||
      value === ""
    ) {
      return null;
    }

    if (
      typeof value ===
        "number" &&
      Number.isFinite(value)
    ) {
      return value;
    }

    const str =
      String(value)
        .trim()
        .replace(
          ",",
          "."
        );

    if (
      /^\d+(\.\d+)?$/
        .test(str)
    ) {
      return (
        Number(str) *
        1000
      );
    }

    const match =
      str.match(
        /^(\d+):([0-5]?\d)(?:\.(\d{1,2}))?$/
      );

    if (!match) {
      return null;
    }

    const cs =
      match[3]
        ? Number(
            match[3]
              .padEnd(
                2,
                "0"
              )
          )
        : 0;

    return (
      Number(match[1]) *
        60000 +
      Number(match[2]) *
        1000 +
      cs *
        10
    );
  }

  function projectOf(
    student,
    race
  ) {
    return (
      student[
        `project${race}`
      ] ||
      student
        ?.races?.[race]
        ?.project ||
      ""
    );
  }

  function projectMetrics(
    student
  ) {
    const p1 =
      parseProject(
        projectOf(
          student,
          1
        )
      );

    const p2 =
      parseProject(
        projectOf(
          student,
          2
        )
      );

    const t1 =
      Number(
        student
          ?.races?.[1]
          ?.totalMs
      );

    const t2 =
      Number(
        student
          ?.races?.[2]
          ?.totalMs
      );

    if (
      p1 == null ||
      p2 == null ||
      !Number.isFinite(t1) ||
      !Number.isFinite(t2)
    ) {
      return null;
    }

    const e1 =
      Math.abs(
        t1 - p1
      );

    const e2 =
      Math.abs(
        t2 - p2
      );

    const sum =
      e1 + e2;

    const seconds =
      sum / 1000;

    let level = 1;

    if (seconds < 8) {
      level = 4;
    } else if (
      seconds <= 15
    ) {
      level = 3;
    } else if (
      seconds <= 24
    ) {
      level = 2;
    }

    return {
      p1,
      p2,
      e1,
      e2,
      sum,
      level
    };
  }

  function fmtPts(value) {
    if (
      value == null ||
      !Number.isFinite(
        Number(value)
      )
    ) {
      return "—";
    }

    return Number(value)
      .toLocaleString(
        "fr-FR",
        {
          maximumFractionDigits:
            2
        }
      );
  }

  function fmtSec(ms) {
    if (
      ms == null ||
      !Number.isFinite(
        Number(ms)
      )
    ) {
      return "—";
    }

    return (
      (
        Number(ms) /
        1000
      ).toLocaleString(
        "fr-FR",
        {
          minimumFractionDigits:
            2,
          maximumFractionDigits:
            2
        }
      ) +
      " s"
    );
  }

  function fmtTime(ms) {
    if (
      ms == null ||
      !Number.isFinite(
        Number(ms)
      )
    ) {
      return "—";
    }

    return time(
      Number(ms)
    );
  }

  function escAttr(value) {
    return String(
      value ?? ""
    )
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      );
  }

  function q(value) {
    return (
      '"' +
      String(
        value ?? ""
      )
        .replace(
          /"/g,
          '""'
        ) +
      '"'
    );
  }

  function currentStudent(id) {
    return activeSession()
      ?.students
      ?.find(
        student =>
          String(
            student.id
          ) ===
          String(id)
      );
  }

  function sessionLocked() {
    return (
      activeSession()
        ?.status ===
      "locked"
    );
  }

  score = scoreCCF;

  function ensureTools() {
    const card =
      $("resultRows")
        ?.closest(
          ".card"
        );

    if (!card) {
      return;
    }

    if (
      !document
        .getElementById(
          "ccfTools"
        )
    ) {
      const toolbar =
        document.createElement(
          "div"
        );

      toolbar.id =
        "ccfTools";

      toolbar.className =
        "toolbar";

      toolbar.innerHTML =
        '<button id="exportCsvCCF">Exporter CSV</button>' +
        '<button id="exportPdfCCF">PDF / Imprimer</button>';

      const filters =
        $("resultFilters");

      filters
        ?.before(
          toolbar
        );

      toolbar
        .querySelector(
          "#exportCsvCCF"
        )
        .onclick =
        exportCSV;

      toolbar
        .querySelector(
          "#exportPdfCCF"
        )
        .onclick =
        printPDF;
    }

    if (
      !document
        .getElementById(
          "ccfDetailDialog"
        )
    ) {
      const dialog =
        document.createElement(
          "dialog"
        );

      dialog.id =
        "ccfDetailDialog";

      dialog.innerHTML =
        '<div id="ccfDetailBox" ' +
        'style="min-width:min(980px,92vw);' +
        'max-height:85vh;overflow:auto;' +
        'background:#fff;padding:18px;' +
        'border-radius:16px"></div>';

      document.body
        .appendChild(
          dialog
        );
    }
  }

  renderResults =
    function() {
      ensureTools();

      const body =
        $("resultRows");

      if (!body) {
        return;
      }

      const locked =
        sessionLocked();

      const header =
        body
          .closest("table")
          ?.querySelector(
            "thead tr"
          );

      if (header) {
        header.innerHTML =
          "<th>Élève</th>" +
          "<th>Classe</th>" +
          "<th>Est. C1</th>" +
          "<th>C1</th>" +
          "<th>Écart</th>" +
          "<th>Est. C2</th>" +
          "<th>C2</th>" +
          "<th>Écart</th>" +
          "<th>Écart cum.</th>" +
          "<th>Niv. estim.</th>" +
          "<th>Meilleur</th>" +
          "<th>Perf /6</th>" +
          "<th>Écart 200</th>" +
          "<th>Eff. /6</th>" +
          "<th>AFL1 /12</th>" +
          "<th>Répart.</th>" +
          "<th>AFL2</th>" +
          "<th>AFL3</th>" +
          "<th>/20</th>" +
          "<th>Détails</th>";
      }

      body.innerHTML =
        visibleStudents()
          .map(
            student => {
              const sc =
                scoreCCF(
                  student
                );

              const pm =
                projectMetrics(
                  student
                );

              const alloc =
                allocation(
                  student
                );

              const l2 =
                student
                  .afl2Level ||
                "";

              const l3 =
                student
                  .afl3Level ||
                "";

              const p2 =
                levelPoints(
                  alloc.a2,
                  l2
                );

              const p3 =
                levelPoints(
                  alloc.a3,
                  l3
                );

              const final =
                sc &&
                p2 != null &&
                p3 != null
                  ? Math.min(
                      20,
                      sc.total +
                        p2 +
                        p3
                    )
                  : null;

              return `
                <tr
                  data-id="${escAttr(
                    student.id
                  )}"
                >

                  <td>
                    <b>
                      ${esc(
                        String(
                          student.last ||
                            ""
                        ).toUpperCase()
                      )}
                      ${esc(
                        student.first ||
                          ""
                      )}
                    </b>
                  </td>

                  <td>
                    ${esc(
                      student.classroom ||
                        ""
                    )}
                  </td>

                  <td>
                    ${esc(
                      projectOf(
                        student,
                        1
                      )
                    )}
                  </td>

                  <td>
                    ${fmtTime(
                      student
                        .races?.[1]
                        ?.totalMs
                    )}
                  </td>

                  <td>
                    ${
                      pm
                        ? fmtSec(
                            pm.e1
                          )
                        : "—"
                    }
                  </td>

                  <td>
                    ${esc(
                      projectOf(
                        student,
                        2
                      )
                    )}
                  </td>

                  <td>
                    ${fmtTime(
                      student
                        .races?.[2]
                        ?.totalMs
                    )}
                  </td>

                  <td>
                    ${
                      pm
                        ? fmtSec(
                            pm.e2
                          )
                        : "—"
                    }
                  </td>

                  <td>
                    ${
                      pm
                        ? fmtSec(
                            pm.sum
                          )
                        : "—"
                    }
                  </td>

                  <td>
                    ${
                      pm
                        ? "Niv. " +
                          pm.level
                        : "—"
                    }
                  </td>

                  <td>
                    ${
                      sc
                        ? fmtTime(
                            sc.best
                          )
                        : "—"
                    }
                  </td>

                  <td>
                    ${
                      sc
                        ? fmtPts(
                            sc.pp
                          )
                        : "—"
                    }
                  </td>

                  <td>
                    ${
                      sc
                        ? fmtSec(
                            sc.spread
                          )
                        : "—"
                    }
                  </td>

                  <td>
                    ${
                      sc
                        ? fmtPts(
                            sc.rp
                          )
                        : "—"
                    }
                  </td>

                  <td>
                    <b>
                      ${
                        sc
                          ? fmtPts(
                              sc.total
                            )
                          : "—"
                      }
                    </b>
                  </td>

                  <td>

                    <select
                      class="afl-allocation"
                      data-id="${escAttr(
                        student.id
                      )}"
                      ${
                        locked
                          ? "disabled"
                          : ""
                      }
                    >

                      <option
                        value="2-6"
                        ${
                          alloc.key ===
                          "2-6"
                            ? "selected"
                            : ""
                        }
                      >
                        2-6
                      </option>

                      <option
                        value="4-4"
                        ${
                          alloc.key ===
                          "4-4"
                            ? "selected"
                            : ""
                        }
                      >
                        4-4
                      </option>

                      <option
                        value="6-2"
                        ${
                          alloc.key ===
                          "6-2"
                            ? "selected"
                            : ""
                        }
                      >
                        6-2
                      </option>

                    </select>

                  </td>

                  <td>

                    <select
                      class="afl-level"
                      data-id="${escAttr(
                        student.id
                      )}"
                      data-key="afl2Level"
                      ${
                        locked
                          ? "disabled"
                          : ""
                      }
                    >

                      <option value="">
                        —
                      </option>

                      ${[
                        1,
                        2,
                        3,
                        4
                      ]
                        .map(
                          level => `
                            <option
                              value="${level}"
                              ${
                                String(
                                  l2
                                ) ===
                                String(
                                  level
                                )
                                  ? "selected"
                                  : ""
                              }
                            >
                              N${level}
                            </option>
                          `
                        )
                        .join("")}

                    </select>

                    <div>
                      ${
                        p2 == null
                          ? "—"
                          : fmtPts(
                              p2
                            ) +
                            "/" +
                            alloc.a2
                      }
                    </div>

                  </td>

                  <td>

                    <select
                      class="afl-level"
                      data-id="${escAttr(
                        student.id
                      )}"
                      data-key="afl3Level"
                      ${
                        locked
                          ? "disabled"
                          : ""
                      }
                    >

                      <option value="">
                        —
                      </option>

                      ${[
                        1,
                        2,
                        3,
                        4
                      ]
                        .map(
                          level => `
                            <option
                              value="${level}"
                              ${
                                String(
                                  l3
                                ) ===
                                String(
                                  level
                                )
                                  ? "selected"
                                  : ""
                              }
                            >
                              N${level}
                            </option>
                          `
                        )
                        .join("")}

                    </select>

                    <div>
                      ${
                        p3 == null
                          ? "—"
                          : fmtPts(
                              p3
                            ) +
                            "/" +
                            alloc.a3
                      }
                    </div>

                  </td>

                  <td>
                    <b>
                      ${
                        final == null
                          ? "—"
                          : fmtPts(
                              final
                            )
                      }
                    </b>
                  </td>

                  <td>

                    <button
                      class="ccf-detail"
                      data-id="${escAttr(
                        student.id
                      )}"
                    >
                      ${
                        locked
                          ? "Voir"
                          : "Voir / modifier"
                      }
                    </button>

                  </td>

                </tr>
              `;
            }
          )
          .join("");

      body
        .querySelectorAll(
          ".afl-allocation"
        )
        .forEach(
          element => {
            element.onchange =
              () => {
                if (
                  sessionLocked()
                ) {
                  renderResults();
                  return;
                }

                const student =
                  currentStudent(
                    element.dataset.id
                  );

                if (!student) {
                  return;
                }

                student.aflAllocation =
                  element.value;

                save();
                renderResults();
              };
          }
        );

      body
        .querySelectorAll(
          ".afl-level"
        )
        .forEach(
          element => {
            element.onchange =
              () => {
                if (
                  sessionLocked()
                ) {
                  renderResults();
                  return;
                }

                const student =
                  currentStudent(
                    element.dataset.id
                  );

                if (!student) {
                  return;
                }

                student[
                  element.dataset.key
                ] =
                  element.value ===
                  ""
                    ? ""
                    : Number(
                        element.value
                      );

                save();
                renderResults();
              };
          }
        );

      body
        .querySelectorAll(
          ".ccf-detail"
        )
        .forEach(
          button => {
            button.onclick =
              () =>
                openDetail(
                  button.dataset.id
                );
          }
        );
    };

  renderStudents =
    function() {
      const body =
        $("students");

      if (!body) {
        return;
      }

      body.innerHTML =
        visibleStudents()
          .map(
            student => {
              const sc =
                scoreCCF(
                  student
                );

              const pm =
                projectMetrics(
                  student
                );

              const locked =
                sessionLocked();

              const project1 =
                projectOf(
                  student,
                  1
                );

              const project2 =
                projectOf(
                  student,
                  2
                );

              return `
                <tr>

                  <td>
                    <b>
                      ${esc(
                        String(
                          student.last ||
                            ""
                        ).toUpperCase()
                      )}
                      ${esc(
                        student.first ||
                          ""
                      )}
                    </b>
                  </td>

                  <td>
                    ${esc(
                      student.classroom ||
                        ""
                    )}
                  </td>

                  <td>
                    <div class="project-cell">
                      <strong>
                        ${esc(
                          project1 ||
                            "—"
                        )}
                      </strong>
                      ${pm
                        ? `<small>${fmtSec(pm.e1)} d'écart</small>`
                        : ""
                      }
                    </div>
                  </td>

                  <td>
                    <strong>
                      ${fmtTime(
                        student
                          .races?.[1]
                          ?.totalMs
                      )}
                    </strong>
                  </td>

                  <td>
                    <div class="project-cell">
                      <strong>
                        ${esc(
                          project2 ||
                            "—"
                        )}
                      </strong>
                      ${pm
                        ? `<small>${fmtSec(pm.e2)} d'écart</small>`
                        : ""
                      }
                    </div>
                  </td>

                  <td>
                    <strong>
                      ${fmtTime(
                        student
                          .races?.[2]
                          ?.totalMs
                      )}
                    </strong>
                  </td>

                  <td>
                    <b>
                      ${sc
                        ? fmtPts(
                            sc.total
                          ) +
                          "/12"
                        : "—"
                      }
                    </b>
                  </td>

                  <td>
                    <button
                      type="button"
                      class="student-edit"
                      data-id="${escAttr(
                        student.id
                      )}"
                    >
                      ${locked
                        ? "Voir"
                        : "✏️ Corriger"
                      }
                    </button>
                  </td>

                </tr>
              `;
            }
          )
          .join("");

      body
        .querySelectorAll(
          ".student-edit"
        )
        .forEach(
          button => {
            button.onclick =
              () =>
                openDetail(
                  button.dataset.id
                );
          }
        );
    };

  function field(
    label,
    id,
    value,
    type = "text",
    readonly = false
  ) {
    return `
      <label
        style="
          display:flex;
          flex-direction:column;
          gap:4px
        "
      >

        <span>
          ${label}
        </span>

        <input
          id="${id}"
          type="${type}"
          value="${escAttr(
            value ?? ""
          )}"
          ${
            readonly
              ? "disabled"
              : ""
          }
        >

      </label>
    `;
  }

  function openDetail(id) {
    const student =
      currentStudent(id);

    if (!student) {
      return;
    }

    const locked =
      sessionLocked();

    const dialog =
      $("ccfDetailDialog");

    const box =
      $("ccfDetailBox");

    const r1 =
      student
        .races?.[1] ||
      {
        splits: []
      };

    const r2 =
      student
        .races?.[2] ||
      {
        splits: []
      };

    const sc =
      scoreCCF(
        student
      );

    const pm =
      projectMetrics(
        student
      );

    box.innerHTML = `

      <div
        style="
          display:flex;
          justify-content:space-between;
          gap:12px;
          align-items:center
        "
      >

        <h2>
          ${esc(
            String(
              student.last ||
                ""
            ).toUpperCase()
          )}
          ${esc(
            student.first ||
              ""
          )}
        </h2>

        <button id="closeCCFDetail">
          Fermer
        </button>

      </div>

      <p>
        ${esc(
          student.classroom ||
            ""
        )}
        ·
        ${esc(
          student.sex ||
            ""
        )}
      </p>

      ${
        locked
          ? `
            <div
              style="
                margin:10px 0 18px;
                padding:12px 14px;
                border-radius:12px;
                background:#f1f5f9;
                border:1px solid #cbd5e1;
                color:#334155;
                font-weight:700
              "
            >
              🔒 Évaluation verrouillée :
              consultation uniquement.
            </div>
          `
          : ""
      }

      <div
        style="
          display:grid;
          grid-template-columns:
            repeat(2,minmax(280px,1fr));
          gap:18px
        "
      >

        <section>

          <h3>
            Course 1
          </h3>

          ${field(
            "Estimation",
            "e_p1",
            projectOf(
              student,
              1
            ),
            "text",
            locked
          )}

          ${field(
            "Temps total (ms)",
            "e_t1",
            r1.totalMs,
            "number",
            locked
          )}

          ${[
            0,
            1,
            2,
            3
          ]
            .map(
              index =>
                field(
                  `${
                    (index + 1) *
                    200
                  } m cumulé (ms)`,
                  `e_s1_${index}`,
                  r1
                    .splits
                    ?.[index] ??
                    "",
                  "number",
                  locked
                )
            )
            .join("")}

        </section>

        <section>

          <h3>
            Course 2
          </h3>

          ${field(
            "Estimation",
            "e_p2",
            projectOf(
              student,
              2
            ),
            "text",
            locked
          )}

          ${field(
            "Temps total (ms)",
            "e_t2",
            r2.totalMs,
            "number",
            locked
          )}

          ${[
            0,
            1,
            2,
            3
          ]
            .map(
              index =>
                field(
                  `${
                    (index + 1) *
                    200
                  } m cumulé (ms)`,
                  `e_s2_${index}`,
                  r2
                    .splits
                    ?.[index] ??
                    "",
                  "number",
                  locked
                )
            )
            .join("")}

        </section>

      </div>

      <hr>

      <div
        style="
          display:grid;
          grid-template-columns:
            repeat(4,minmax(120px,1fr));
          gap:10px
        "
      >

        <div>
          <b>AFL1</b>
          <br>
          ${
            sc
              ? fmtPts(
                  sc.total
                ) +
                "/12"
              : "—"
          }
        </div>

        <div>
          <b>Performance</b>
          <br>
          ${
            sc
              ? fmtPts(
                  sc.pp
                ) +
                "/6"
              : "—"
          }
        </div>

        <div>
          <b>Efficacité</b>
          <br>
          ${
            sc
              ? fmtPts(
                  sc.rp
                ) +
                "/6"
              : "—"
          }
        </div>

        <div>
          <b>Écart 200</b>
          <br>
          ${
            sc
              ? fmtSec(
                  sc.spread
                )
              : "—"
          }
        </div>

      </div>

      ${
        sc
          ? `
            <p>
              <b>
                Fractions C1 :
              </b>

              ${
                sc.laps1
                  .map(
                    fmtTime
                  )
                  .join(
                    " · "
                  )
              }
            </p>

            <p>
              <b>
                Fractions C2 :
              </b>

              ${
                sc.laps2
                  .map(
                    fmtTime
                  )
                  .join(
                    " · "
                  )
              }
            </p>

            <p>
              <b>
                200 le plus rapide :
              </b>

              ${fmtTime(
                sc.fastest200
              )}

              ·

              <b>
                200 le plus lent :
              </b>

              ${fmtTime(
                sc.slowest200
              )}
            </p>
          `
          : ""
      }

      ${
        pm
          ? `
            <p>
              <b>
                Estimation / régulation :
              </b>

              écart cumulé

              ${fmtSec(
                pm.sum
              )}

              → niveau indicatif

              ${pm.level}
            </p>
          `
          : ""
      }

      <div
        style="
          display:flex;
          gap:10px;
          justify-content:flex-end
        "
      >

        ${
          locked
            ? `
              <button
                type="button"
                disabled
              >
                Évaluation verrouillée
              </button>
            `
            : `
              <button
                id="saveCCFDetail"
              >
                Enregistrer et recalculer
              </button>
            `
        }

      </div>
    `;

    $("closeCCFDetail")
      .onclick =
      () =>
        dialog.close();

    if (!locked) {
      $("saveCCFDetail")
        .onclick =
        () => {
          if (
            sessionLocked()
          ) {
            alert(
              "Cette évaluation vient d'être verrouillée. Modification annulée."
            );

            dialog.close();

            render();

            return;
          }

          student.project1 =
            $("e_p1")
              .value
              .trim();

          student.project2 =
            $("e_p2")
              .value
              .trim();

          student.races =
            student.races ||
            {};

          [
            1,
            2
          ].forEach(
            race => {
              student
                .races[race] =
                student
                  .races[race] ||
                {};

              student
                .races[race]
                .project =
                student[
                  `project${race}`
                ];

              student
                .races[race]
                .totalMs =
                Number(
                  $(
                    `e_t${race}`
                  ).value
                ) ||
                0;

              student
                .races[race]
                .splits =
                [
                  0,
                  1,
                  2,
                  3
                ].map(
                  index =>
                    Number(
                      $(
                        `e_s${race}_${index}`
                      ).value
                    ) ||
                    0
                );
            }
          );

          save();

          dialog.close();

          render();
        };
    }

    dialog.showModal();
  }

  function exportRows() {
    return visibleStudents()
      .map(
        student => {
          const sc =
            scoreCCF(
              student
            );

          const pm =
            projectMetrics(
              student
            );

          const alloc =
            allocation(
              student
            );

          const p2 =
            levelPoints(
              alloc.a2,
              student.afl2Level
            );

          const p3 =
            levelPoints(
              alloc.a3,
              student.afl3Level
            );

          const final =
            sc &&
            p2 != null &&
            p3 != null
              ? Math.min(
                  20,
                  sc.total +
                    p2 +
                    p3
                )
              : null;

          return {
            s: student,
            sc,
            pm,
            a: alloc,
            p2,
            p3,
            final
          };
        }
      );
  }

  function exportCSV() {
    const headers = [
      "Nom",
      "Prénom",
      "Classe",
      "Sexe",
      "Estimation C1",
      "Temps C1",
      "Écart C1",
      "C1 200",
      "C1 400",
      "C1 600",
      "C1 800",
      "Estimation C2",
      "Temps C2",
      "Écart C2",
      "C2 200",
      "C2 400",
      "C2 600",
      "C2 800",
      "Écart estimation cumulé",
      "Niveau estimation",
      "Meilleur 800",
      "Performance /6",
      "200 plus rapide",
      "200 plus lent",
      "Écart 200",
      "Efficacité /6",
      "AFL1 /12",
      "Répartition",
      "AFL2",
      "AFL3",
      "Note /20"
    ];

    const rows =
      exportRows()
        .map(
          ({
            s,
            sc,
            pm,
            a,
            p2,
            p3,
            final
          }) => {
            const splits1 =
              [
                ...(
                  s
                    .races?.[1]
                    ?.splits ||
                  []
                )
              ];

            const splits2 =
              [
                ...(
                  s
                    .races?.[2]
                    ?.splits ||
                  []
                )
              ];

            while (
              splits1.length <
              4
            ) {
              splits1.push(
                null
              );
            }

            while (
              splits2.length <
              4
            ) {
              splits2.push(
                null
              );
            }

            return [
              s.last,
              s.first,
              s.classroom,
              s.sex,

              projectOf(
                s,
                1
              ),

              fmtTime(
                s
                  .races?.[1]
                  ?.totalMs
              ),

              pm
                ? fmtSec(
                    pm.e1
                  )
                : "",

              ...splits1
                .slice(
                  0,
                  4
                )
                .map(
                  value =>
                    value == null
                      ? ""
                      : fmtTime(
                          value
                        )
                ),

              projectOf(
                s,
                2
              ),

              fmtTime(
                s
                  .races?.[2]
                  ?.totalMs
              ),

              pm
                ? fmtSec(
                    pm.e2
                  )
                : "",

              ...splits2
                .slice(
                  0,
                  4
                )
                .map(
                  value =>
                    value == null
                      ? ""
                      : fmtTime(
                          value
                        )
                ),

              pm
                ? fmtSec(
                    pm.sum
                  )
                : "",

              pm
                ? pm.level
                : "",

              sc
                ? fmtTime(
                    sc.best
                  )
                : "",

              sc
                ? fmtPts(
                    sc.pp
                  )
                : "",

              sc
                ? fmtTime(
                    sc.fastest200
                  )
                : "",

              sc
                ? fmtTime(
                    sc.slowest200
                  )
                : "",

              sc
                ? fmtSec(
                    sc.spread
                  )
                : "",

              sc
                ? fmtPts(
                    sc.rp
                  )
                : "",

              sc
                ? fmtPts(
                    sc.total
                  )
                : "",

              a.key,

              p2 == null
                ? ""
                : `${fmtPts(
                    p2
                  )}/${a.a2}`,

              p3 == null
                ? ""
                : `${fmtPts(
                    p3
                  )}/${a.a3}`,

              final == null
                ? ""
                : fmtPts(
                    final
                  )
            ];
          }
        );

    const csv =
      "\ufeff" +
      [
        headers,
        ...rows
      ]
        .map(
          row =>
            row
              .map(q)
              .join(";")
        )
        .join("\n");

    const blob =
      new Blob(
        [
          csv
        ],
        {
          type:
            "text/csv;charset=utf-8"
        }
      );

    const link =
      document.createElement(
        "a"
      );

    link.href =
      URL.createObjectURL(
        blob
      );

    link.download =
      `${
        activeGroup()
          ?.name ||
        "groupe"
      }_${
        activeSession()
          ?.label ||
        "releve"
      }_CCF.csv`
        .replace(
          /[^a-z0-9_.-]+/gi,
          "_"
        );

    link.click();

    setTimeout(
      () =>
        URL.revokeObjectURL(
          link.href
        ),
      1000
    );
  }

  function printPDF() {
    const group =
      activeGroup();

    const session =
      activeSession();

    const rows =
      exportRows();

    const detail =
      rows
        .map(
          ({
            s,
            sc,
            a,
            p2,
            p3,
            final
          }) => `
            <tr>

              <td>
                ${esc(
                  String(
                    s.last ||
                      ""
                  ).toUpperCase()
                )}
                ${esc(
                  s.first ||
                    ""
                )}
              </td>

              <td>
                ${esc(
                  s.classroom ||
                    ""
                )}
              </td>

              <td>
                ${
                  sc
                    ? fmtPts(
                        sc.total
                      ) +
                      "/12"
                    : "—"
                }
              </td>

              <td>
                ${esc(
                  a.key
                )}
              </td>

              <td>
                ${
                  p2 == null
                    ? "—"
                    : fmtPts(
                        p2
                      ) +
                      "/" +
                      a.a2
                }
              </td>

              <td>
                ${
                  p3 == null
                    ? "—"
                    : fmtPts(
                        p3
                      ) +
                      "/" +
                      a.a3
                }
              </td>

              <td>
                ${
                  final == null
                    ? "—"
                    : fmtPts(
                        final
                      ) +
                      "/20"
                }
              </td>

            </tr>
          `
        )
        .join("");

    const full =
      rows
        .map(
          ({
            s,
            sc,
            pm
          }) => `
            <section>

              <h3>
                ${esc(
                  String(
                    s.last ||
                      ""
                  ).toUpperCase()
                )}
                ${esc(
                  s.first ||
                    ""
                )}
                ·
                ${esc(
                  s.classroom ||
                    ""
                )}
              </h3>

              <p>
                C1 :
                estimation
                ${
                  esc(
                    projectOf(
                      s,
                      1
                    )
                  ) ||
                  "—"
                }
                · réalisé
                ${fmtTime(
                  s
                    .races?.[1]
                    ?.totalMs
                )}
                · écart
                ${
                  pm
                    ? fmtSec(
                        pm.e1
                      )
                    : "—"
                }
              </p>

              <p>
                Passages C1 :
                ${
                  (
                    s
                      .races?.[1]
                      ?.splits ||
                    []
                  )
                    .slice(
                      0,
                      4
                    )
                    .map(
                      fmtTime
                    )
                    .join(
                      " · "
                    ) ||
                  "—"
                }
              </p>

              <p>
                C2 :
                estimation
                ${
                  esc(
                    projectOf(
                      s,
                      2
                    )
                  ) ||
                  "—"
                }
                · réalisé
                ${fmtTime(
                  s
                    .races?.[2]
                    ?.totalMs
                )}
                · écart
                ${
                  pm
                    ? fmtSec(
                        pm.e2
                      )
                    : "—"
                }
              </p>

              <p>
                Passages C2 :
                ${
                  (
                    s
                      .races?.[2]
                      ?.splits ||
                    []
                  )
                    .slice(
                      0,
                      4
                    )
                    .map(
                      fmtTime
                    )
                    .join(
                      " · "
                    ) ||
                  "—"
                }
              </p>

              <p>
                Écart estimation cumulé :
                ${
                  pm
                    ? fmtSec(
                        pm.sum
                      ) +
                      " · niveau indicatif " +
                      pm.level
                    : "—"
                }
              </p>

              <p>
                AFL1 :
                ${
                  sc
                    ? fmtPts(
                        sc.total
                      ) +
                      "/12 · performance " +
                      fmtPts(
                        sc.pp
                      ) +
                      "/6 · efficacité " +
                      fmtPts(
                        sc.rp
                      ) +
                      "/6 · écart 200 " +
                      fmtSec(
                        sc.spread
                      )
                    : "—"
                }
              </p>

            </section>
          `
        )
        .join("");

    const windowPrint =
      window.open(
        "",
        "_blank"
      );

    if (!windowPrint) {
      alert(
        "Autorise les fenêtres surgissantes pour générer le PDF."
      );

      return;
    }

    windowPrint.document.write(
      `<!doctype html>

      <html lang="fr">

      <head>

        <meta charset="utf-8">

        <title>
          CCF Demi-fond
        </title>

        <style>

          body{
            font-family:Arial,sans-serif;
            padding:24px;
            color:#111
          }

          h1{
            margin-bottom:4px
          }

          table{
            width:100%;
            border-collapse:collapse;
            margin:20px 0
          }

          th,
          td{
            border:1px solid #bbb;
            padding:6px;
            font-size:12px
          }

          th{
            background:#eee
          }

          section{
            break-inside:avoid;
            border-top:1px solid #ccc;
            padding:10px 0
          }

          p{
            margin:5px 0
          }

          @media print{

            button{
              display:none
            }

          }

        </style>

      </head>

      <body>

        <h1>
          Demi-fond CCF
        </h1>

        <p>
          <b>
            ${esc(
              group
                ?.name ||
              ""
            )}
          </b>

          ·

          ${esc(
            session
              ?.label ||
            ""
          )}

          ${
            session?.status
              ? " · " +
                esc(
                  session.status ===
                    "locked"
                    ? "Verrouillée"
                    : session.status ===
                      "closed"
                      ? "Terminée"
                      : "En cours"
                )
              : ""
          }
        </p>

        <h2>
          Récapitulatif par élève
        </h2>

        <table>

          <thead>

            <tr>
              <th>Élève</th>
              <th>Classe</th>
              <th>AFL1</th>
              <th>Répartition</th>
              <th>AFL2</th>
              <th>AFL3</th>
              <th>Note</th>
            </tr>

          </thead>

          <tbody>
            ${detail}
          </tbody>

        </table>

        <h2>
          Détail AFL1 et courses
        </h2>

        ${full}

        <script>
          window.onload =
            () =>
              window.print();
        <\/script>

      </body>

      </html>`
    );

    windowPrint.document.close();
  }

  try {
    render();
  } catch (error) {
    console.error(
      "evaluation-ccf init",
      error
    );
  }

})();
