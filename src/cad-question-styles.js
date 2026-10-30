export const cadQuestionStyles=`
.cad-question-dialog{width:min(1180px,96vw)!important;max-height:94dvh!important;padding:0!important;border:1px solid #315467!important;border-radius:12px;color:#dce8ef;background:#0b1d29;box-shadow:0 24px 90px #0009;overflow:auto;font-family:Arial,'Malgun Gothic',sans-serif!important;font-size:14px!important;line-height:1.6!important}
.cad-question-dialog::backdrop{background:#020912b8}
.cad-question-dialog *{box-sizing:border-box;font-family:inherit!important;letter-spacing:normal!important}
.cad-question-dialog h2{font-size:20px!important;line-height:1.4;margin:0 0 8px!important;font-weight:700}
.cad-question-dialog h3{font-size:16px!important;margin:0!important}
.cad-question-dialog p,.cad-question-dialog label,.cad-question-dialog strong,.cad-question-dialog summary{font-size:14px!important;line-height:1.6}
.cad-question-dialog .cq-header{padding:22px 24px 16px;background:#102735;border-bottom:1px solid #315467}
.cad-question-dialog .cq-header p{margin:8px 0 0;color:#adc2cf}
.cad-question-dialog .cq-status{padding:12px 24px;margin:0;background:#0a202d;color:#70d5ee;border-bottom:1px solid #294756}
.cad-question-dialog .cq-content{padding:0 24px 20px}
.cad-question-dialog section{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px!important;background:#102633;border:1px solid #315467!important;border-radius:8px;padding:18px!important;margin:16px 0!important}
.cad-question-dialog section>h3,.cad-question-dialog section>p{grid-column:1/-1}
.cad-question-dialog section>p{padding:12px;border-left:3px solid #e9b45d;background:#302b22;color:#f2d5a5;margin:0!important}
.cad-question-dialog figure{margin:0;min-width:0}.cad-question-dialog img{border-radius:6px;border:1px solid #315467;display:block}
.cad-question-dialog figcaption{font-size:12px!important;color:#93adbd;padding-top:8px}
.cad-question-dialog label{display:block;color:#c3d4df}
.cad-question-dialog textarea,.cad-question-dialog select,.cad-question-dialog input{background:#081b27!important;color:#e1edf3!important;border:1px solid #456477!important;border-radius:6px!important;font:14px/1.5 Arial,'Malgun Gothic',sans-serif!important;padding:10px!important;max-width:100%;min-height:40px}
.cad-question-dialog textarea{width:100%;min-height:150px;resize:vertical;margin-top:12px!important}
.cad-question-dialog :focus-visible{outline:2px solid #42cdeb!important;outline-offset:2px}
.cad-question-dialog button{font-size:13px!important;line-height:1.4!important;min-height:38px;padding:9px 14px!important;margin:0!important;background:#173444;color:#dce8ef;border:1px solid #456477;border-radius:6px;white-space:normal}
.cad-question-dialog button:disabled{opacity:.45}.cad-question-dialog button.cq-primary{background:#00add0;color:#001923;border-color:#00add0;font-weight:700}
.cad-question-dialog footer{position:sticky;bottom:0;display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:16px 24px!important;background:#0b1d29;border-top:1px solid #315467;box-shadow:0 -8px 24px #06131c88}
.cad-question-dialog footer .cq-group{display:flex;gap:8px;flex-wrap:wrap}.cad-question-dialog footer p{width:100%;margin:0;font-size:12px!important}
.cad-question-dialog details{padding:12px 0;border-bottom:1px solid #294756}.cad-question-dialog summary{cursor:pointer;color:#95cfe0}.cad-question-dialog pre{font:12px/1.5 monospace!important;white-space:pre-wrap;overflow-wrap:anywhere}
.cad-question-dialog .cq-attachment{display:grid;gap:10px;padding:12px 0;grid-template-columns:180px minmax(0,1fr)}
.cad-question-dialog .cq-empty{min-height:210px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;background:#081b27;border:1px dashed #456477;border-radius:6px;padding:24px;color:#9ab3c2}
@media(max-width:760px){.cad-question-dialog section{grid-template-columns:1fr}.cad-question-dialog .cq-header,.cad-question-dialog .cq-content,.cad-question-dialog footer{padding:16px!important}.cad-question-dialog .cq-attachment{grid-template-columns:1fr}}
`;
