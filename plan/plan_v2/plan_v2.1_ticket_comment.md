
1. Overlay, column no show in modern react
eg in QDDSSRC SFLCTL: S
SFL_ACCT__
SFL_NAME______________________
SFL_BAL_____
S


2. What is the problems about QDDSSRC WCONHDRD ZZSF01 "Manual review
ZZCT02.SHWREC uses non-editable usage H.
REFFLD length for ZZCT02.XWG4TX needs review.
REFFLD length for ZZCT02.SNAME needs review.
REFFLD length for ZZCT02.XWIDV0 needs review.
REFFLD length for ZZCT02.XWGIVA needs review.
ZZFT01.SFIELD uses non-editable usage H.
ZZFT01.RECNAM uses non-editable usage H.
REFFLD length for ZZFT01.XWG4TX needs review.
REFFLD length for ZZFT01.PNAME needs review.
REFFLD length for ZZCNF1.XWG4TX needs review.
REFFLD length for ZZCNF1.PNAME needs review."
;
ZZCT01 "Manual review
ZZCT01.SHWREC uses non-editable usage H.
ZZFT01.SFIELD uses non-editable usage H.
ZZFT01.RECNAM uses non-editable usage H.
REFFLD length for ZZFT01.ZWE0NB needs review.
REFFLD length for ZZFT01.ZWJUN0 needs review.
REFFLD length for ZZFT01.PNAME needs review.
REFFLD length for ZZFT01.ZWGIVA needs review.
ZZFT02.SFIELD uses non-editable usage H.
ZZFT02.RECNAM uses non-editable usage H.
REFFLD length for ZZFT02.ZWF0VA needs review.
REFFLD length for ZZFT02.ZWF0V0 needs review.
REFFLD length for ZZFT02.ZWF1VA needs review.
REFFLD length for ZZFT02.ZWF1V0 needs review.
REFFLD length for ZZFT02.ZWF2VA needs review.
REFFLD length for ZZFT02.ZWF3VA needs review.
REFFLD length for ZZFT02.ZWF4VA needs review.
REFFLD length for ZZFT02.ZWF6VA needs review.
REFFLD length for ZZFT02.ZWIDV0 needs review.
REFFLD length for ZZFT02.ZWGAVA needs review.
REFFLD length for ZZFT02.ZWGBVA needs review.
REFFLD length for ZZFT02.ZWGCVA needs review.
REFFLD length for ZZFT02.ZWGDVA needs review.
REFFLD length for ZZFT02.ZWGEVA needs review.
REFFLD length for ZZFT02.ZWGFVA needs review.
REFFLD length for ZZFT02.ZWGGVA needs review.
REFFLD length for ZZFT02.ZCUSNO needs review.
REFFLD length for ZZCNF1.ZWF0VA needs review.
REFFLD length for ZZCNF1.ZWF0V0 needs review.
REFFLD length for ZZCNF1.ZWF1VA needs review.
REFFLD length for ZZCNF1.ZWF1V0 needs review.
REFFLD length for ZZCNF1.ZWF2VA needs review.
REFFLD length for ZZCNF1.ZWF3VA needs review.
REFFLD length for ZZCNF1.ZWF4VA needs review.
REFFLD length for ZZCNF1.ZWF6VA needs review.
REFFLD length for ZZCNF1.ZWIDV0 needs review.
REFFLD length for ZZCNF1.ZWGAVA needs review.
REFFLD length for ZZCNF1.ZWGBVA needs review.
REFFLD length for ZZCNF1.ZWGCVA needs review.
REFFLD length for ZZCNF1.ZWGDVA needs review.
REFFLD length for ZZCNF1.ZWGEVA needs review.
REFFLD length for ZZCNF1.ZWGFVA needs review.
REFFLD length for ZZCNF1.ZWGGVA needs review.
REFFLD length for ZZCNF1.ZCUSNO needs review."
如C:\Users\ZY92193\Documents\workspace\project\DSPF-RAD\plan\plan_v2\img\review.png
3. C:\Users\ZY92193\Documents\workspace\project\DSPF-RAD\INPUT\IBM-i-RPG-Free-CLP-Code\Z_Exp1 B2R 解析有問題?

## 回覆與架構判斷

### 1. Overlay、source column 與 SFLCTL 欄位沒有完整顯示

目前 Converted pane 只讀取 `DspfDocument.activeRecord` 的 items。它沒有把 `SFLCTL`、linked `SFL` template、page state 與 record relation 合併成一個 Modern table。

`QDDSSRC/WCONHDRD.DSPF` 的 `ZZSF01` 是 SFL，`ZZCT01` 是 `SFLCTL(ZZSF01)`。以下欄位屬於 SFL row template：

```text
DSSEL   row 13 col 2
XWORDN  row 13 col 5
XWCREF  row 13 col 13
XWDLDT  row 13 col 35
XWSTAT  row 13 col 47
XWTAMT  row 13 col 56
PERSON  row 13 col 51
```

`ZZCT01` 另外定義：

```text
SFLPAG(0009)
SFLSIZ(0013)
SFLDSP
SFLDSPCTL
SFLCLR
SFLEND(*MORE)
```

目前 Modern pane 未完整合併這些資料，所以 SFL rows、SFL page state、SFL end state 和 source column ruler 不完整。這是 semantic conversion 尚未完成，不是單純 CSS 問題。

對應 ticket：

```text
V2.1-1A DspfSemanticIR
V2.1-1C record relation and reference graph
V2.1-1E profile-based semantic layout mapper
V2.1-1F complete semantic converted screen
```

### 2. `usage H` warning 的原因

`usage H` 通常代表 hidden 或 technical field。它不一定是錯誤，也不應直接生成一般使用者 input。

例如 `WCONHDRD.DSPF`：

```text
SHWREC  4S 0H  SFLRCDNBR(CURSOR)
SFIELD  10A H
RECNAM  10A H
RTNCSRLOC(&RECNAM &SFIELD)
```

這些欄位可能負責：

```text
cursor return
record name return
field name return
subfile cursor row
choice control
program-to-display state
```

因此 Modern React 第一版應：

```text
不顯示為一般 editable input
保留在 Semantic IR
保留 source identity
保留 runtime binding metadata
顯示 technical/manual-review 狀態
```

`usage H` warning 的意思是：「這個 field 不是一般可編輯 field，需要確認它的 runtime role。」

### 3. `REFFLD length needs review` 的原因

例如：

```text
XWG4TX R O 4 38 REFFLD(XWG4TX XAN4CDEM/CUSTS)
SNAME  R O 5 30 REFFLD(PNAME XAN4CDEM/SLMEN)
```

目前 DSPF source 沒有完整提供：

```text
field length
data type
decimals
validation
reference source definition
```

實際定義位於外部 PF/DD source：

```text
XAN4CDEM/CUSTS
XAN4CDEM/SLMEN
```

目前 parser 不能安全讀取這些外部 source，因此使用 placeholder length 並輸出 manual-review。這是安全行為，不能把 placeholder 當成正式 schema。

建議處理順序：

1. 先尋找並讀取 referenced PF/DD source。
2. 解析實際 length、type、decimals 與 validation。
3. 將結果寫入 reference graph。
4. 如果 source 不存在，使用 Inspector manual override。
5. 將 override owner、時間與原因寫入 conversion report。

對應 ticket：

```text
V2.1-1C qualified identity and reference graph
V2.1-1D capability and manual-review classification
```

### 4. `B2R.RPGLE` 是否解析有問題

目前專案的 `parseDspf()` 只解析 DSPF/DDS source。它不是 RPGLE parser。

因此：

```text
B2.DSPF 可以由 parseDspf() 解析
B2R.RPGLE 不會由 parseDspf() 完整解析
```

`B2R.RPGLE` 的 runtime code 會提供 DSPF source 沒有的值與流程：

```rpg
A#SNG1T = 'Sel 1';
A#SNG2T = 'Sel 2';
A#SNG3T = 'Sel 3';
SingleArr = O_AVAIL;
MultArr = O_AVAIL;
P1ANR = 1;
A#MLT1 = O_SELECTED;
exfmt TESTR;
*in02 = *on;
exfmt TESTR;
```

`B2.DSPF` 中的相關欄位是：

```text
A#SNG1/A#SNG2/A#SNG3   hidden CHCCTL fields
A#SNG1T/A#SNG2T/A#SNG3T program-to-system labels
P1ANR                  SNGCHCFLD
A#MLT1/A#MLT2/A#MLT3  hidden MLTCHCFLD controls
P2INT                  MLTCHCFLD
MSG                    runtime message field
```

所以目前 Modern React 看不到 `Sel 1`、availability、selected state 或 `F12 Modify`，不是單純 DSPF parse error。這些值由 RPGLE runtime assignment 決定。

建議第一版建立 display binding adapter，不立即建立完整 RPGLE compiler：

```text
B2.DSPF
    ↓
DspfSemanticIR
    ↓
RPGLE display binding map
    ↓
Modern React runtime values and workflow hints
```

binding map 應至少記錄：

```json
{
  "displayFile": "B2",
  "record": "TESTR",
  "field": "A#SNG1T",
  "runtimeSource": "B2R.A#SNG1T",
  "role": "choice-label",
  "status": "manual-review"
}
```

對應後續 ticket：

```text
V2.1-1G Define RPGLE display binding adapter
```

### 5. 目前結論

目前 Modern React 是 visual conversion preview，不是完整 semantic conversion。下列項目仍未完成：

```text
SFLCTL → SFL semantic merge
WINDOW ownership
REFFLD source resolver
CHCCTL reference graph
RPGLE runtime binding
AID and EXFMT workflow
indicator runtime state
message and cursor state
```

因此不應把目前的 `manual-review` warning 視為程式錯誤。它指出 converter 缺少外部 source 或 runtime context。下一步應先完成 V2.1-1A 至 V2.1-1G，再擴充完整 Modern React screen layout。
C:\Users\ZY92193\Documents\workspace\project\DSPF-RAD\plan\plan_v2\img\REVIEW2.png