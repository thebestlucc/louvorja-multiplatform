FILE: fmArquivosFalta.pas
================================================
Error reading file with 'utf-8': 'utf-8' codec can't decode byte 0xe3 in position 3100: invalid continuation byte


================================================
FILE: fmAtualiza.ddp
================================================
[Binary file]


================================================
FILE: fmAtualiza.dfm
================================================
object fAtualiza: TfAtualiza
  Left = 379
  Top = 277
  BorderIcons = []
  BorderStyle = bsDialog
  Caption = 'Download de Arquivos...'
  ClientHeight = 164
  ClientWidth = 553
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -11
  Font.Name = 'MS Sans Serif'
  Font.Style = []
  OldCreateOrder = False
  Position = poScreenCenter
  Scaled = False
  OnActivate = FormActivate
  OnClose = FormClose
  OnCreate = FormCreate
  PixelsPerInch = 96
  TextHeight = 13
  object GridPanel1: TGridPanel
    Left = 41
    Top = 0
    Width = 512
    Height = 122
    Align = alClient
    BevelOuter = bvNone
    Caption = 'GridPanel1'
    ColumnCollection = <
      item
        SizeStyle = ssAbsolute
        Value = 90.000000000000000000
      end
      item
        Value = 100.000000000000000000
      end
      item
        SizeStyle = ssAbsolute
        Value = 130.000000000000000000
      end>
    ControlCollection = <
      item
        Column = 0
        Control = img1
        Row = 1
        RowSpan = 2
      end
      item
        Column = 0
        ColumnSpan = 3
        Control = sTitulo
        Row = 0
      end
      item
        Column = 1
        Control = pbProgresso
        Row = 1
      end
      item
        Column = 2
        Control = sProgresso
        Row = 1
      end
      item
        Column = 1
        Control = pbProgressoT
        Row = 2
      end
      item
        Column = 2
        Control = sProgressoT
        Row = 2
      end>
    RowCollection = <
      item
        SizeStyle = ssAbsolute
        Value = 50.000000000000000000
      end
      item
        SizeStyle = ssAbsolute
        Value = 35.000000000000000000
      end
      item
        SizeStyle = ssAbsolute
        Value = 35.000000000000000000
      end
      item
        Value = 100.000000000000000000
      end>
    ShowCaption = False
    TabOrder = 1
    object img1: TbsPngImageView
      Left = 0
      Top = 50
      Width = 90
      Height = 70
      DoubleBuffered = False
      ReflectionEffect = False
      PngImageList = DM.ico_64x64
      ImageIndex = 3
      Align = alClient
      Center = True
      ExplicitWidth = 64
      ExplicitHeight = 64
    end
    object sTitulo: TbsSkinLabel
      AlignWithMargins = True
      Left = 10
      Top = 0
      Width = 499
      Height = 47
      Margins.Left = 10
      Margins.Top = 0
      HintImageIndex = 0
      TabOrder = 0
      SkinData = DM.bsSkinData1
      SkinDataName = 'label'
      DefaultFont.Charset = DEFAULT_CHARSET
      DefaultFont.Color = clWindowText
      DefaultFont.Height = 13
      DefaultFont.Name = 'Tahoma'
      DefaultFont.Style = []
      DefaultWidth = 0
      DefaultHeight = 0
      UseSkinFont = True
      Transparent = False
      ShadowEffect = False
      ShadowColor = clBlack
      ShadowOffset = 0
      ShadowSize = 3
      ReflectionEffect = False
      ReflectionOffset = -5
      EllipsType = bsetNoneEllips
      UseSkinSize = True
      UseSkinFontColor = True
      BorderStyle = bvNone
      Align = alClient
      Caption = '..........'
      AutoSize = False
    end
    object pbProgresso: TProgressBar
      AlignWithMargins = True
      Left = 93
      Top = 57
      Width = 286
      Height = 21
      Margins.Top = 7
      Margins.Bottom = 7
      Align = alClient
      TabOrder = 1
    end
    object sProgresso: TbsSkinLabel
      AlignWithMargins = True
      Left = 385
      Top = 57
      Width = 124
      Height = 21
      Margins.Top = 7
      Margins.Bottom = 7
      HintImageIndex = 0
      TabOrder = 2
      SkinData = DM.bsSkinData1
      SkinDataName = 'label'
      DefaultFont.Charset = DEFAULT_CHARSET
      DefaultFont.Color = clWindowText
      DefaultFont.Height = 13
      DefaultFont.Name = 'Tahoma'
      DefaultFont.Style = []
      DefaultWidth = 0
      DefaultHeight = 0
      UseSkinFont = True
      Transparent = False
      ShadowEffect = False
      ShadowColor = clBlack
      ShadowOffset = 0
      ShadowSize = 3
      ReflectionEffect = False
      ReflectionOffset = -5
      EllipsType = bsetNoneEllips
      UseSkinSize = True
      UseSkinFontColor = True
      BorderStyle = bvNone
      Align = alClient
      Caption = '          '
      AutoSize = False
    end
    object pbProgressoT: TProgressBar
      AlignWithMargins = True
      Left = 93
      Top = 92
      Width = 286
      Height = 21
      Margins.Top = 7
      Margins.Bottom = 7
      Align = alClient
      TabOrder = 3
    end
    object sProgressoT: TbsSkinLabel
      AlignWithMargins = True
      Left = 385
      Top = 92
      Width = 124
      Height = 21
      Margins.Top = 7
      Margins.Bottom = 7
      HintImageIndex = 0
      TabOrder = 4
      SkinData = DM.bsSkinData1
      SkinDataName = 'label'
      DefaultFont.Charset = DEFAULT_CHARSET
      DefaultFont.Color = clWindowText
      DefaultFont.Height = 13
      DefaultFont.Name = 'Tahoma'
      DefaultFont.Style = []
      DefaultWidth = 0
      DefaultHeight = 0
      UseSkinFont = True
      Transparent = False
      ShadowEffect = False
      ShadowColor = clBlack
      ShadowOffset = 0
      ShadowSize = 3
      ReflectionEffect = False
      ReflectionOffset = -5
      EllipsType = bsetNoneEllips
      UseSkinSize = True
      UseSkinFontColor = True
      BorderStyle = bvNone
      Align = alClient
      Caption = '          '
      AutoSize = False
    end
  end
  object bsSkinPanel1: TbsSkinPanel
    Left = 0
    Top = 122
    Width = 553
    Height = 42
    HintImageIndex = 0
    TabOrder = 2
    SkinData = DM.bsSkinData1
    SkinDataName = 'panel'
    DefaultFont.Charset = DEFAULT_CHARSET
    DefaultFont.Color = clWindowText
    DefaultFont.Height = 13
    DefaultFont.Name = 'Tahoma'
    DefaultFont.Style = []
    DefaultWidth = 0
    DefaultHeight = 0
    UseSkinFont = True
    EmptyDrawing = False
    RibbonStyle = False
    ImagePosition = bsipDefault
    TransparentMode = False
    CaptionImageIndex = -1
    RealHeight = -1
    AutoEnabledControls = True
    CheckedMode = False
    Checked = False
    DefaultAlignment = taLeftJustify
    DefaultCaptionHeight = 20
    BorderStyle = bvNone
    CaptionMode = False
    RollUpMode = False
    RollUpState = False
    NumGlyphs = 1
    Spacing = 2
    Caption = 'bsSkinPanel1'
    Align = alBottom
    object bsSkinButton2: TbsSkinButton
      AlignWithMargins = True
      Left = 456
      Top = 5
      Width = 92
      Height = 32
      Margins.Left = 5
      Margins.Top = 5
      Margins.Right = 5
      Margins.Bottom = 5
      HintImageIndex = 0
      TabOrder = 1
      SkinData = DM.bsSkinData1
      SkinDataName = 'button'
      DefaultFont.Charset = DEFAULT_CHARSET
      DefaultFont.Color = clWindowText
      DefaultFont.Height = 13
      DefaultFont.Name = 'Tahoma'
      DefaultFont.Style = []
      DefaultWidth = 0
      DefaultHeight = 0
      UseSkinFont = True
      Transparent = False
      CheckedMode = False
      ImageList = DM.ico_24x24
      ImageIndex = 1
      AlwaysShowLayeredFrame = False
      UseSkinSize = False
      UseSkinFontColor = True
      RepeatMode = False
      RepeatInterval = 100
      AllowAllUp = False
      TabStop = True
      CanFocused = True
      Down = False
      GroupIndex = 0
      Caption = 'Cancelar'
      NumGlyphs = 1
      Spacing = 1
      Align = alRight
      OnClick = bsSkinButton2Click
    end
    object sStatus: TbsSkinLabel
      AlignWithMargins = True
      Left = 10
      Top = 0
      Width = 438
      Height = 39
      Margins.Left = 10
      Margins.Top = 0
      HintImageIndex = 0
      TabOrder = 0
      SkinData = DM.bsSkinData1
      SkinDataName = 'label'
      DefaultFont.Charset = DEFAULT_CHARSET
      DefaultFont.Color = clWindowText
      DefaultFont.Height = 13
      DefaultFont.Name = 'Tahoma'
      DefaultFont.Style = []
      DefaultWidth = 0
      DefaultHeight = 0
      UseSkinFont = True
      Transparent = False
      ShadowEffect = False
      ShadowColor = clBlack
      ShadowOffset = 0
      ShadowSize = 3
      ReflectionEffect = False
      ReflectionOffset = -5
      EllipsType = bsetNoneEllips
      UseSkinSize = True
      UseSkinFontColor = True
      BorderStyle = bvNone
      Align = alClient
      Caption = '..........'
      AutoSize = False
    end
  end
  object ftp: TValueListEditor
    Left = 0
    Top = 0
    Width = 41
    Height = 122
    Align = alLeft
    TabOrder = 0
    Visible = False
    ColWidths = (
      59
      -24)
  end
  object bsBusinessSkinForm1: TbsBusinessSkinForm
    UseRibbon = False
    ShowMDIScrollBars = True
    WindowState = wsNormal
    QuickButtons = <
      item
        AllowAllUp = False
        Down = False
        ImageIndex = 15
        Enabled = True
        Visible = False
        Caption = 'Atualizar Colet'#226'nea'
        Position = bsqbpLeft
      end>
    QuickButtonsShowHint = False
    QuickButtonsShowDivider = True
    ClientInActiveEffect = False
    ClientInActiveEffectType = bsieSemiTransparent
    DisableSystemMenu = False
    AlwaysResize = False
    PositionInMonitor = bspScreenCenter
    UseFormCursorInNCArea = False
    MaxMenuItemsInWindow = 0
    ClientWidth = 0
    ClientHeight = 0
    HideCaptionButtons = True
    HideCloseButton = False
    AlwaysShowInTray = False
    LogoBitMapTransparent = False
    AlwaysMinimizeToTray = False
    UseSkinFontInMenu = True
    UseSkinFontInCaption = True
    UseSkinSizeInMenu = True
    ShowIcon = False
    MaximizeOnFullScreen = False
    AlphaBlend = False
    AlphaBlendAnimation = False
    AlphaBlendValue = 200
    ShowObjectHint = False
    MenusAlphaBlend = False
    MenusAlphaBlendAnimation = False
    MenusAlphaBlendValue = 200
    DefCaptionFont.Charset = DEFAULT_CHARSET
    DefCaptionFont.Color = clBtnText
    DefCaptionFont.Height = 13
    DefCaptionFont.Name = 'Tahoma'
    DefCaptionFont.Style = [fsBold]
    DefInActiveCaptionFont.Charset = DEFAULT_CHARSET
    DefInActiveCaptionFont.Color = clBtnShadow
    DefInActiveCaptionFont.Height = 13
    DefInActiveCaptionFont.Name = 'Tahoma'
    DefInActiveCaptionFont.Style = [fsBold]
    DefMenuItemHeight = 20
    DefMenuItemFont.Charset = DEFAULT_CHARSET
    DefMenuItemFont.Color = clWindowText
    DefMenuItemFont.Height = 13
    DefMenuItemFont.Name = 'Tahoma'
    DefMenuItemFont.Style = []
    UseDefaultSysMenu = True
    SkinData = DM.bsSkinData1
    MinimizeApplication = False
    MinHeight = 0
    MinWidth = 0
    MaxHeight = 0
    MaxWidth = 0
    MinClientHeight = 0
    MinClientWidth = 0
    MaxClientHeight = 0
    MaxClientWidth = 0
    Magnetic = False
    MagneticSize = 5
    BorderIcons = []
    Left = 230
    Top = 12
  end
  object IdFTP1: TIdFTP
    OnDisconnected = IdFTP1Disconnected
    OnWork = IdFTP1Work
    OnWorkBegin = IdFTP1WorkBegin
    OnWorkEnd = IdFTP1WorkEnd
    IPVersion = Id_IPv4
    ConnectTimeout = 0
    TransferType = ftBinary
    NATKeepAlive.UseKeepAlive = False
    NATKeepAlive.IdleTimeMS = 0
    NATKeepAlive.IntervalMS = 0
    ProxySettings.ProxyType = fpcmNone
    ProxySettings.Port = 0
    Left = 280
    Top = 8
  end
  object tmrFecha: TTimer
    Enabled = False
    Interval = 10
    OnTimer = tmrFechaTimer
    Left = 104
    Top = 24
  end
end



================================================
FILE: fmAtualiza.pas
================================================
﻿unit fmAtualiza;

interface

uses
  Windows, Messages, SysUtils, Variants, Classes, Graphics, Controls, Forms,
  Dialogs, ExtCtrls, IdHTTP, IdSSLOpenSSL, StdCtrls, ValEdit, OleCtrls,
  IdCoderMIME, ShellAPI, Grids, bsSkinCtrls, IdIPWatch,
  BusinessSkinForm, strutils, bsPngImageList, IdIOHandler,
  IdIOHandlerStack, IdSSL, IdCoder,
  IdComponent, IdTCPConnection, IdTCPClient,
  IdFTP, Vcl.ComCtrls, IdBaseComponent, IdExplicitTLSClientServerBase;

type
  TfAtualiza = class(TForm)
    bsBusinessSkinForm1: TbsBusinessSkinForm;
    IdFTP1: TIdFTP;
    GridPanel1: TGridPanel;
    img1: TbsPngImageView;
    sTitulo: TbsSkinLabel;
    pbProgresso: TProgressBar;
    sProgresso: TbsSkinLabel;
    pbProgressoT: TProgressBar;
    sProgressoT: TbsSkinLabel;
    bsSkinPanel1: TbsSkinPanel;
    bsSkinButton2: TbsSkinButton;
    tmrFecha: TTimer;
    ftp: TValueListEditor;
    sStatus: TbsSkinLabel;
    procedure FormActivate(Sender: TObject);
    procedure ftp_conecta();
    procedure ftp_baixa();
    procedure IdFTP1Work(ASender: TObject; AWorkMode: TWorkMode;
      AWorkCount: Int64);
    procedure IdFTP1WorkEnd(ASender: TObject; AWorkMode: TWorkMode);
    procedure IdFTP1WorkBegin(ASender: TObject; AWorkMode: TWorkMode;
      AWorkCountMax: Int64);
    procedure bsSkinButton2Click(Sender: TObject);
    procedure tmrFechaTimer(Sender: TObject);
    procedure FormCreate(Sender: TObject);
    procedure IdFTP1Disconnected(Sender: TObject);
    procedure FormClose(Sender: TObject; var Action: TCloseAction);
  private
    { Private declarations }
    arquivo_temp: string;
    arq: Integer;
  public
    { Public declarations }
    arquivos: TStringList;
    arquivos_falha: TStringList;
    ftp_url: string;
    ftp_dir: string;
    ftp_porta: integer;
    ftp_usuario: string;
    ftp_senha: string;
    cancela: Boolean;
    erro: Boolean;
  end;

var
  fAtualiza: TfAtualiza;

implementation

uses
  fmMenu, dmComponentes, fmIniciando;

{$R *.dfm}

procedure TfAtualiza.ftp_baixa;
var
  arquivo_ftp: string;
  i: Integer;
  size: integer;
begin
  arq := -1;
  for i := 0 to arquivos.Count-1 do
  begin
    if tmrFecha.Enabled = true then Continue;

    arq := i;
    if not IdFTP1.Connected then
    begin
      sTitulo.Caption := 'Conexão perdida... Reconectando...';
      ftp_conecta();
    end;

    arquivo_temp := 'arquivo_'+formatdatetime('yyyymmdd_hhnnsszzz', Now())+'.~tmp';
    arquivo_ftp := StringReplace(arquivos[i], '\', '/', [rfIgnoreCase, rfReplaceAll]);

    fmIndex.gravaLog('Baixando: '+ftp_dir+arquivo_ftp);

    sTitulo.Caption := 'Baixando arquivo '''+ExtractFileName(fmIndex.dir_temp+arquivos[i])+'''';
    sProgressoT.Caption := 'Arquivo '+IntToStr(i+1)+' / '+inttostr(arquivos.Count);

    pbProgressoT.Max := arquivos.Count+1;
    pbProgressoT.Position := i+1;
//    pbProgresso.Position := 0;
//    pbProgresso.Max := 0;

    size := 0;

    try
      DM.qrARQUIVOS_SISTEMA.Locate('URL',arquivos[i],[]);
      size := DM.qrARQUIVOS_SISTEMA.FieldByName('TAMANHO').AsInteger;
    except
    end;

    //ShowMessage(arquivos[i]+' / '+inttostr(size)+' / '+DM.qrARQUIVOS_SISTEMA.FieldByName('ARQUIVO').asstring);
    if (size <= 0) then
      size := IdFTP1.Size(ftp_dir+arquivo_ftp);

    if (size <= 0) then
    begin
      pbProgresso.Max := 0;
      pbProgresso.Style := pbstMarquee;
    end
    else
    begin
      pbProgresso.Max := size;
      pbProgresso.Style := pbstNormal;
    end;

    try
   // ShowMessage(AnsiToUtf8(ftp_dir+arquivo_ftp));
      IdFTP1.Get(trim(ftp_dir+arquivo_ftp), Trim(fmIndex.dir_temp+arquivo_temp), true, false);
    except
      on E: Exception do
      begin
//        ShowMessage('Erro: ' + E.Message );
        try
          sTitulo.Caption := 'Falha no download... Tentando novamente...';
          Sleep(2000);
          ftp_conecta();
          sTitulo.Caption := 'Baixando arquivo '''+ExtractFileName(fmIndex.dir_temp+arquivos[i])+'''';
          IdFTP1.Get(Trim(ftp_dir+arquivo_ftp), trim(fmIndex.dir_temp+arquivo_temp), true, false);
        except
        //ShowMessage('Erro: ' + E.Message+' = '+ftp_dir+arquivo_ftp);
          arquivos_falha.Add(arquivos[i]);
          sStatus.Caption := 'Falha no download: '+inttostr(arquivos_falha.Count);
        end;
      end;
    end;

  end;

  sTitulo.Caption := 'Finalizando...';
  pbProgressoT.Max := 1;
  pbProgressoT.Position := 1;
  tmrFecha.Enabled := True;
end;

procedure TfAtualiza.ftp_conecta;
var
  msg: String;
begin
  IdFTP1.Disconnect();
  Sleep(2000);

  IdFTP1.Host := ftp_url;
  IdFTP1.Port := ftp_porta;
  IdFTP1.Username := ftp_usuario;
  IdFTP1.Password := ftp_senha;
  IdFTP1.Passive := true; { usa modo ativo }
//  IdFTP1.RecvBufferSize := 8192;

  try
    IdFTP1.Connect;
  except
    on E: Exception do
    begin
      msg := '';

      if (Pos('too many connections', LowerCase(E.Message)) > 0) or
         (Pos('servidor sobrecarregado', LowerCase(E.Message)) > 0) then
      begin
        msg := 'O servidor está sobrecarregado. Muitos usuários estão atualizando os arquivos neste momento. Tente novamente em alguns minutos!'+#13#10;
      end;

      if (Application.MessageBox(PChar('Não foi possível conectar ao servidor!'
          +#13#10
          +msg
          +#13#10
          +'Causa do erro: '+E.Message
          +#13#10
          +'Tentar novamente?'
      ),fmIndex.TITULO,mb_yesno+MB_ICONERROR) = 6)
        then ftp_conecta()
        else tmrFecha.Enabled := true;
    end;
  end;
end;

procedure TfAtualiza.IdFTP1Disconnected(Sender: TObject);
begin
  if (tmrFecha.Enabled) then Exit;
//  ShowMessage('Desconectado');
end;

procedure TfAtualiza.IdFTP1Work(ASender: TObject; AWorkMode: TWorkMode;
  AWorkCount: Int64);
begin
  if (tmrFecha.Enabled) then Exit;
  pbProgresso.Position := AWorkCount;
//  if (pbProgresso.MaxValue <= 0) then
//    pbProgresso.MaxValue := pbProgresso.Value;

  sProgresso.Caption := inttostr(AWorkCount div 1024)+ ' KB / ' +inttostr(pbProgresso.Max div 1024)+ ' KB';
end;

procedure TfAtualiza.IdFTP1WorkBegin(ASender: TObject; AWorkMode: TWorkMode;
  AWorkCountMax: Int64);
begin
  if (tmrFecha.Enabled) then Exit;
  pbProgresso.Position := 0;
  if (pbProgresso.Max <= 0) then
    pbProgresso.Max := AWorkCountMax;
end;

procedure TfAtualiza.IdFTP1WorkEnd(ASender: TObject; AWorkMode: TWorkMode);
var
  dir: string;
begin
  if (tmrFecha.Enabled) then Exit;

  pbProgresso.Position := pbProgresso.Max;

  dir := ExtractFilePath(ExtractFilePath(application.ExeName)+arquivos[arq]);
  if not DirectoryExists(dir)
    then ForceDirectories(dir);

  CopyFile(PChar(fmIndex.dir_temp+arquivo_temp), PChar(ExtractFilePath(application.ExeName)+arquivos[arq]), false);
  DeleteFile(fmIndex.dir_temp+arquivo_temp);
end;

procedure TfAtualiza.tmrFechaTimer(Sender: TObject);
begin
  //tmrFecha.Enabled := False;
  try
    if IdFTP1.Connected then
    begin
      try
        IdFTP1.Disconnect;
        IdFTP1.Abort;
      except
        //
      end;
     // IdFTP1.Free;
    end;
  except
    //
  end;
  fAtualiza.close;
end;

procedure TfAtualiza.bsSkinButton2Click(Sender: TObject);
begin
  cancela := True;
  try
    tmrFecha.Enabled := true;
  except
    //
  end;
  pbProgresso.Position := 0;
  pbProgressoT.Position := 0;
end;

procedure TfAtualiza.FormActivate(Sender: TObject);
var
  lParams: string;
  ret_ftp: string;
  LinkPag,txt: string;
  ip: TIdIPWatch;
  url: string;
  dados_ftp: Boolean;
  tentat: Integer;
begin
  cancela := False;
  erro := False;
//  if DM.tmrSair.Enabled = true then Exit;

  tmrFecha.Enabled := False;
  arquivos_falha := TStringList.Create;
  sStatus.Caption := '';

  fmIndex.gravaLog('Conectando FTP');

  sTitulo.Caption := 'Buscando informações...';
  pbProgresso.Style := pbstMarquee;

  fmIndex.gravaLog('URL: '+fmIndex.url_params);

  DM.IdHTTP1.Request.CustomHeaders.Values['Api-Token'] := fmIndex.api_token;
  try
    LinkPag := DM.IdHTTP1.Get(fmIndex.url_params);
  except
    Sleep(2000);
    try
      LinkPag := DM.IdHTTP1.Get(fmIndex.url_params);
    except
      Application.MessageBox(PChar('Não foi possível se conectar!'),fmIndex.TITULO,mb_ok+MB_ICONERROR);
      tmrFecha.Enabled := True;
      erro := True;
      Exit;
    end;
  end;
  //txt := fmIndex.ExtraiTexto(LinkPag, '<params>', '</params>');
  txt := LinkPag;
  txt := IfThen(trim(txt) = '', '=', txt);
  fmIndex.Param.Strings.Text := txt;
  fmIndex.Param.Strings.SaveToFile(fmIndex.dir_dados + 'configweb.ja');


  if (fmIndex.param.Strings.Values['conn_ftp'] = '') then
  begin
    Application.MessageBox(PChar('Não foi possível buscar informações de conexão!'),fmIndex.TITULO,mb_ok+MB_ICONERROR);
    tmrFecha.Enabled := True;
    erro := True;
    Exit;
  end;

  ret_ftp := '';
  dados_ftp := False;
  tentat := 0;
  if (trim(fmIndex.loadCol.Strings.Values['FTP']) = '') then
  begin
    while (tmrFecha.Enabled = False) and (Trim(ret_ftp) = '')  do
    begin
      application.processmessages;
      tentat := tentat+1;
      ip := TIdIPWatch.Create(nil);
  //    lParams := TStringList.Create;
      lParams := '';
      lParams := lParams+'&lang='+fIniciando.LANG;
      lParams := lParams+'&version=' + fmIndex.lblVersao.Caption;
      lParams := lParams+'&bin_version=' + fmIndex.VersaoExe;
      lParams := lParams+'&datetime=' + formatdatetime('yyyy-mm-dd hh:nn:ss', Now());
      lParams := lParams+'&ip=' + ip.LocalIP;
      lParams := lParams+'&directory=' + Application.ExeName;
  //    lParams := lParams+'&parametros=' + GetCommandLine;
      fmIndex.paramtemp.Lines.Clear;
      fmIndex.paramtemp.Text := fmIndex.GetComputerNameFunc;
      lParams := lParams+'&pc_name=' + trim(fmIndex.paramtemp.Lines[0]);

      if Pos('?', fmIndex.param.Strings.Values['conn_ftp']) > 0 then
        url := fmIndex.param.Strings.Values['conn_ftp']+'&data='+DM.IdEncoderMIME.EncodeString(lParams)+'&lang='+fIniciando.LANG
      else
        url := fmIndex.param.Strings.Values['conn_ftp']+'?data='+DM.IdEncoderMIME.EncodeString(lParams)+'&lang='+fIniciando.LANG;

      fmIndex.gravaLog('URL para autorização de conexão: '+url);

      while (tmrFecha.Enabled = False) and (dados_ftp = False)  do
      begin
        dados_ftp := True;
        application.processmessages;
        try
          ret_ftp := DM.idHttp1.Get(url);
        except
          on E: Exception do
          begin
            dados_ftp := False;
            if (Application.MessageBox(PChar('Não foi possível obter dados FTP! O servidor pode estar indisponível, ou o programa não possui permissões de acesso à internet.'+#13#10+'Causa do erro: '+E.Message+#13#10+'Tentar novamente?'),fmIndex.TITULO,mb_yesno+MB_ICONERROR) <> 6) then
            begin
              fmIndex.erro_log.Lines.Add(E.Message);
              fmIndex.erro_log.Lines.Add(url);
              tmrFecha.Enabled := True;
              Sleep(1);
              erro := True;
              Break;
              Exit;
            end
            else
            begin
              sTitulo.Caption := 'Reconectando...';
              Sleep(2);
            end;
          end;
        end;
      end;

      if (tmrFecha.Enabled = true) then
      begin
        Sleep(1);
        Break;
        Continue;
        Exit;
      end;

      if (dados_ftp = true) then
      begin
        if (Trim(ret_ftp) = '') then
        begin
          if (tentat <= 5) then
          begin
            sTitulo.Caption := 'Não foi possível obter dados da conexão! Tentando novamente...';
            dados_ftp := False;
            Sleep(2);
          end
          else
          begin
            if (Application.MessageBox(PChar('Não foi possível obter dados da conexão!'+#13#10+'Tentar novamente?'),fmIndex.TITULO,mb_yesno+MB_ICONERROR) <> 6) then
            begin
              fmIndex.erro_log.Lines.Add(ret_ftp);
              fmIndex.erro_log.Lines.Add(url);
              tmrFecha.Enabled := True;
              erro := True;
              Break;
              Exit;
            end
            else
            begin
              sTitulo.Caption := 'Reconectando...';
              tentat := 0;
              dados_ftp := False;
              Sleep(2);
            end;
          end;
        end
        else
        begin
          ftp.Strings.Text := DM.IdDecoderMIME.DecodeString(ret_ftp);
          fmIndex.loadCol.Strings.Values['FTP'] := ftp.Strings.Text;
        end;
      end;
    end;
  end
  else
  begin
    ftp.Strings.Text := fmIndex.loadCol.Strings.Values['FTP'];
    dados_ftp := True;
    ret_ftp := DM.IdEncoderMIME.EncodeString(ftp.Strings.Text);
  end;

  if (tmrFecha.Enabled = true) or (dados_ftp = false) or (Trim(ret_ftp) = '') then
  begin
    sTitulo.Caption := 'Finalizando...';
    tmrFecha.Enabled := true;
    Exit;
  end;


  if (ftp.Values['ftp_msg'] <> '') then
  begin
    Application.MessageBox(PChar(ftp.Values['ftp_msg']),fmIndex.TITULO,mb_ok+MB_ICONERROR);
    fmIndex.loadCol.Strings.Values['FTP'] := '';
    tmrFecha.Enabled := True;
    Exit;
  end;

  arquivo_temp := '';

  ftp_url := ftp.Values['host'];
  ftp_dir := ftp.Values['root'];
  ftp_porta := StrToInt('0'+ftp.Values['port']);
  ftp_usuario := ftp.Values['username'];
  ftp_senha := ftp.Values['password'];

  fmIndex.gravaLog('ftp_url: '+ftp_url);
  fmIndex.gravaLog('ftp_dir: '+ftp_dir);
//  fmIndex.gravaLog('ftp_porta: '+inttostr(ftp_porta));
//  fmIndex.gravaLog('ftp_usuario: '+ftp_usuario);
//  fmIndex.gravaLog('ftp_senha: *****************');

  sTitulo.Caption := 'Conectando ao servidor...';
  ftp_conecta();

  if tmrFecha.Enabled = True then
  begin
    sTitulo.Caption := 'Finalizando...';
    Exit;
  end;

  sTitulo.Caption := 'Obtendo informações dos arquivos...';
  try
    DM.qrARQUIVOS_SISTEMA.Close;
    DM.qrARQUIVOS_SISTEMA.Open;
  except
  end;
  ftp_baixa();
end;

procedure TfAtualiza.FormClose(Sender: TObject; var Action: TCloseAction);
begin
  tmrFecha.Enabled := False;
end;

procedure TfAtualiza.FormCreate(Sender: TObject);
var
  Result : Integer;
  SearchRec: TSearchRec;
begin
  if (DirectoryExists(fmIndex.dir_temp)) then
  begin
    result := FindFirst(fmIndex.dir_temp+'*.*', faAnyFile, SearchRec);
    While Result = 0 do
    begin
      DeleteFile(fmIndex.dir_temp + SearchRec.Name);
      Result := FindNext(SearchRec);
    end;
  end
  else CreateDir(fmIndex.dir_temp);
end;

end.




================================================
FILE: fmBuscaMusica.dfm
================================================
object fBuscaMusica: TfBuscaMusica
  Left = 0
  Top = 0
  BorderIcons = []
  Caption = 'Busca de M'#250'sicas'
  ClientHeight = 296
  ClientWidth = 701
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -11
  Font.Name = 'Tahoma'
  Font.Style = []
  KeyPreview = True
  OldCreateOrder = False
  Scaled = False
  OnActivate = FormActivate
  OnKeyUp = FormKeyUp
  OnResize = FormResize
  PixelsPerInch = 96
  TextHeight = 13
  object GridPanel3: TGridPanel
    Left = 0
    Top = 0
    Width = 701
    Height = 57
    Align = alTop
    BevelOuter = bvNone
    Caption = 'GridPanel2'
    ColumnCollection = <
      item
        SizeStyle = ssAbsolute
        Value = 30.000000000000000000
      end
      item
        Value = 100.000000000000000000
      end
      item
        SizeStyle = ssAbsolute
        Value = 30.000000000000000000
      end>
    ControlCollection = <
      item
        Column = 1
        Control = txtBusca
        Row = 1
      end
      item
        Column = 1
        Control = bsSkinStdLabel5
        Row = 0
      end>
    RowCollection = <
      item
        Value = 50.000000000000000000
      end
      item
        SizeStyle = ssAbsolute
        Value = 19.000000000000000000
      end
      item
        Value = 50.000000000000000000
      end>
    ShowCaption = False
    TabOrder = 0
    object txtBusca: TbsSkinEdit
      Left = 30
      Top = 19
      Width = 641
      Height = 19
      Text = ''
      DefaultColor = clWindow
      DefaultFont.Charset = DEFAULT_CHARSET
      DefaultFont.Color = clBlack
      DefaultFont.Height = 13
      DefaultFont.Name = 'Tahoma'
      DefaultFont.Style = []
      UseSkinFont = True
      DefaultWidth = 0
      DefaultHeight = 0
      ButtonMode = False
      SkinData = DM.bsSkinData1
      SkinDataName = 'edit'
      Align = alClient
      Font.Charset = DEFAULT_CHARSET
      Font.Color = clBlack
      Font.Height = 13
      Font.Name = 'Tahoma'
      Font.Style = []
      ParentFont = False
      TabOrder = 0
      ButtonImageIndex = -1
      LeftImageIndex = -1
      LeftImageHotIndex = -1
      LeftImageDownIndex = -1
      RightImageIndex = -1
      RightImageHotIndex = -1
      RightImageDownIndex = -1
      OnChange = txtBuscaChange
      OnKeyPress = txtBuscaKeyPress
      OnKeyUp = txtBuscaKeyUp
    end
    object bsSkinStdLabel5: TbsSkinStdLabel
      Left = 30
      Top = 0
      Width = 641
      Height = 19
      EllipsType = bsetNone
      UseSkinFont = True
      UseSkinColor = True
      DefaultFont.Charset = DEFAULT_CHARSET
      DefaultFont.Color = clWindowText
      DefaultFont.Height = -11
      DefaultFont.Name = 'Tahoma'
      DefaultFont.Style = []
      SkinData = DM.bsSkinData1
      SkinDataName = 'stdlabel'
      Align = alClient
      Caption = 'Localizar M'#250'sica:'
      Layout = tlCenter
      ExplicitWidth = 80
      ExplicitHeight = 13
    end
  end
  object DBGrid1: TbsSkinDBGrid
    Left = 0
    Top = 57
    Width = 682
    Height = 220
    HintImageIndex = 0
    TabOrder = 1
    SkinData = DM.bsSkinData1
    SkinDataName = 'grid'
    Transparent = False
    WallpaperStretch = False
    UseSkinFont = True
    UseSkinCellHeight = True
    VScrollBar = bsSkinScrollBar7
    GridLineColor = clBtnFace
    DefaultCellHeight = 20
    Font.Charset = DEFAULT_CHARSET
    Font.Color = clWindowText
    Font.Height = -16
    Font.Name = 'MS Sans Serif'
    Font.Style = [fsBold]
    ColSizingWithLine = False
    DrawGraphicFields = False
    UseColumnsFont = False
    MouseWheelSupport = True
    SaveMultiSelection = False
    PickListBoxSkinDataName = 'listbox'
    PickListBoxCaptionMode = False
    Align = alClient
    Ctl3D = False
    DataSource = dsBUSCA
    Options = [dgTitles, dgRowLines, dgTabs, dgRowSelect, dgConfirmDelete, dgCancelOnExit]
    ParentCtl3D = False
    ParentFont = False
    TitleFont.Charset = DEFAULT_CHARSET
    TitleFont.Color = clWindowText
    TitleFont.Height = -11
    TitleFont.Name = 'MS Sans Serif'
    TitleFont.Style = [fsBold]
    OnDrawColumnCell = DBGrid1DrawColumnCell
    OnDblClick = DBGrid1DblClick
    Columns = <
      item
        Expanded = False
        FieldName = 'NOME_ALBUM_COM'
        Font.Charset = DEFAULT_CHARSET
        Font.Color = clWindowText
        Font.Height = -11
        Font.Name = 'MS Sans Serif'
        Font.Style = [fsBold]
        Title.Caption = #193'lbum'
        Width = 305
        Visible = True
      end
      item
        Expanded = False
        FieldName = 'ICONE1'
        Title.Caption = '  '
        Width = 20
        Visible = True
      end
      item
        Expanded = False
        FieldName = 'NOME'
        Font.Charset = DEFAULT_CHARSET
        Font.Color = clWindowText
        Font.Height = -11
        Font.Name = 'MS Sans Serif'
        Font.Style = []
        Title.Caption = 'M'#250'sica'
        Width = 367
        Visible = True
      end>
  end
  object stBusca: TbsSkinStatusBar
    Left = 0
    Top = 277
    Width = 701
    Height = 19
    HintImageIndex = 0
    TabOrder = 3
    SkinData = DM.bsSkinData1
    SkinDataName = 'statusbar'
    DefaultFont.Charset = DEFAULT_CHARSET
    DefaultFont.Color = clWindowText
    DefaultFont.Height = 13
    DefaultFont.Name = 'Tahoma'
    DefaultFont.Style = []
    DefaultWidth = 0
    DefaultHeight = 0
    UseSkinFont = True
    EmptyDrawing = False
    RibbonStyle = False
    ImagePosition = bsipDefault
    TransparentMode = False
    CaptionImageIndex = -1
    RealHeight = -1
    AutoEnabledControls = True
    CheckedMode = False
    Checked = False
    DefaultAlignment = taLeftJustify
    DefaultCaptionHeight = 20
    BorderStyle = bvNone
    CaptionMode = False
    RollUpMode = False
    RollUpState = False
    NumGlyphs = 1
    Spacing = 2
    Align = alBottom
    SizeGrip = False
    object stBusca_0: TbsSkinStatusPanel
      Left = 0
      Top = 0
      Width = 320
      Height = 19
      HintImageIndex = 0
      TabOrder = 0
      SkinData = DM.bsSkinData1
      SkinDataName = 'statuspanel'
      DefaultFont.Charset = DEFAULT_CHARSET
      DefaultFont.Color = clWindowText
      DefaultFont.Height = 13
      DefaultFont.Name = 'Tahoma'
      DefaultFont.Style = []
      DefaultWidth = 0
      DefaultHeight = 0
      UseSkinFont = True
      Transparent = False
      ShadowEffect = False
      ShadowColor = clBlack
      ShadowOffset = 0
      ShadowSize = 3
      ReflectionEffect = False
      ReflectionOffset = -5
      EllipsType = bsetNoneEllips
      UseSkinSize = True
      UseSkinFontColor = True
      BorderStyle = bvFrame
      Align = alClient
      AutoSize = False
      ImageIndex = -1
      NumGlyphs = 1
    end
    object stBusca_1: TbsSkinStatusPanel
      Left = 320
      Top = 0
      Width = 381
      Height = 19
      HintImageIndex = 0
      TabOrder = 1
      SkinData = DM.bsSkinData1
      SkinDataName = 'statuspanel'
      DefaultFont.Charset = DEFAULT_CHARSET
      DefaultFont.Color = clWindowText
      DefaultFont.Height = 13
      DefaultFont.Name = 'Tahoma'
      DefaultFont.Style = []
      DefaultWidth = 0
      DefaultHeight = 0
      UseSkinFont = True
      Transparent = False
      ShadowEffect = False
      ShadowColor = clBlack
      ShadowOffset = 0
      ShadowSize = 3
      ReflectionEffect = False
      ReflectionOffset = -5
      EllipsType = bsetNoneEllips
      UseSkinSize = True
      UseSkinFontColor = True
      BorderStyle = bvFrame
      Align = alRight
      AutoSize = False
      ImageIndex = -1
      NumGlyphs = 1
    end
  end
  object bsSkinScrollBar7: TbsSkinScrollBar
    Left = 682
    Top = 57
    Width = 19
    Height = 220
    HintImageIndex = 0
    TabOrder = 2
    Visible = False
    SkinData = DM.bsSkinData1
    SkinDataName = 'vscrollbar'
    DefaultFont.Charset = DEFAULT_CHARSET
    DefaultFont.Color = clWindowText
    DefaultFont.Height = 13
    DefaultFont.Name = 'Tahoma'
    DefaultFont.Style = []
    DefaultWidth = 19
    DefaultHeight = 0
    UseSkinFont = True
    Both = False
    BothMarkerWidth = 19
    BothSkinDataName = 'bothhscrollbar'
    CanFocused = False
    Align = alRight
    Kind = sbVertical
    PageSize = 0
    Min = 0
    Max = 0
    Position = 0
    SmallChange = 1
    LargeChange = 1
  end
  object bsBusinessSkinForm1: TbsBusinessSkinForm
    UseRibbon = False
    ShowMDIScrollBars = True
    WindowState = wsNormal
    QuickButtons = <
      item
        AllowAllUp = False
        Down = False
        ImageIndex = 15
        Enabled = True
        Visible = False
        Caption = 'Atualizar Colet'#226'nea'
        Position = bsqbpLeft
      end>
    QuickButtonsShowHint = False
    QuickButtonsShowDivider = True
    ClientInActiveEffect = False
    ClientInActiveEffectType = bsieSemiTransparent
    DisableSystemMenu = False
    AlwaysResize = False
    PositionInMonitor = bspScreenCenter
    UseFormCursorInNCArea = False
    MaxMenuItemsInWindow = 0
    ClientWidth = 0
    ClientHeight = 0
    HideCaptionButtons = False
    HideCloseButton = False
    AlwaysShowInTray = False
    LogoBitMapTransparent = False
    AlwaysMinimizeToTray = False
    UseSkinFontInMenu = True
    UseSkinFontInCaption = True
    UseSkinSizeInMenu = True
    ShowIcon = False
    MaximizeOnFullScreen = False
    AlphaBlend = False
    AlphaBlendAnimation = False
    AlphaBlendValue = 200
    ShowObjectHint = False
    MenusAlphaBlend = False
    MenusAlphaBlendAnimation = False
    MenusAlphaBlendValue = 200
    DefCaptionFont.Charset = DEFAULT_CHARSET
    DefCaptionFont.Color = clBtnText
    DefCaptionFont.Height = 13
    DefCaptionFont.Name = 'Tahoma'
    DefCaptionFont.Style = [fsBold]
    DefInActiveCaptionFont.Charset = DEFAULT_CHARSET
    DefInActiveCaptionFont.Color = clBtnShadow
    DefInActiveCaptionFont.Height = 13
    DefInActiveCaptionFont.Name = 'Tahoma'
    DefInActiveCaptionFont.Style = [fsBold]
    DefMenuItemHeight = 20
    DefMenuItemFont.Charset = DEFAULT_CHARSET
    DefMenuItemFont.Color = clWindowText
    DefMenuItemFont.Height = 13
    DefMenuItemFont.Name = 'Tahoma'
    DefMenuItemFont.Style = []
    UseDefaultSysMenu = True
    SkinData = DM.bsSkinData1
    MinimizeApplication = False
    MinHeight = 0
    MinWidth = 0
    MaxHeight = 0
    MaxWidth = 0
    MinClientHeight = 0
    MinClientWidth = 0
    MaxClientHeight = 0
    MaxClientWidth = 0
    Magnetic = False
    MagneticSize = 5
    BorderIcons = [biMaximize]
    Left = 167
    Top = 135
  end
  object qrBUSCA: TFDQuery
    Filtered = True
    Connection = DM.ADO
    SQL.Strings = (
      
        'SELECT DISTINCT '#39#39' AS ICONE1,'#39#39' AS ICONE2,'#39#39' AS ICONE3, M.ID ID,' +
        ' M.ID_ALBUM ID_ALBUM, M.NOME_ALBUM NOME_ALBUM, M.NOME_ALBUM_COM ' +
        'NOME_ALBUM_COM, M.FAIXA FAIXA, M.NOME NOME,'
      
        '    M.NOME_COM NOME_COM, M.TIPO_HASD TIPO_HASD, M.TIPO_JA TIPO_J' +
        'A, M.TIPO_BAIXADA TIPO_BAIXADA, M.TIPO_WEB TIPO_WEB, M.TIPO_PERS' +
        'O TIPO_PERSO, M.TIPO TIPO, M.URL_ALBUM URL_ALBUM,'
      
        '    M.ALBUM ALBUM, M.URL URL, M.URL_INSTRUMENTAL URL_INSTRUMENTA' +
        'L,'
      
        '    M.IDIOMA IDIOMA, M.LETRA LETRA, M.NOME_SEMAC NOME_SEMAC, M.N' +
        'OME_ALBUM_COM_SEMAC NOME_ALBUM_COM_SEMAC'
      'FROM LISTA_MUSICAS M'
      'WHERE'
      
        '    (CAST(:VALOR AS INTEGER) > 0 AND TIPO_HASD = '#39'S'#39' AND FAIXA =' +
        ' :VALOR)'
      '    OR'
      
        '    (CAST(:VALOR AS INTEGER) <= 0 AND NOME_SEMAC LIKE '#39'%'#39' || :VA' +
        'LOR || '#39'%'#39')'
      '')
    Left = 354
    Top = 148
    ParamData = <
      item
        Name = 'VALOR'
        ParamType = ptInput
        Value = Null
      end>
  end
  object dsBUSCA: TDataSource
    DataSet = qrBUSCA
    Left = 390
    Top = 148
  end
end



================================================
FILE: fmBuscaMusica.pas
================================================
Error reading file with 'utf-8': 'utf-8' codec can't decode byte 0xba in position 4486: invalid start byte


================================================
FILE: fmEditorSlides.dfm
================================================
object fEditorSlides: TfEditorSlides
  Left = 0
  Top = 0
  ClientHeight = 431
  ClientWidth = 1263
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -11
  Font.Name = 'Tahoma'
  Font.Style = []
  KeyPreview = True
  OldCreateOrder = False
  Position = poScreenCenter
  WindowState = wsMaximized
  OnActivate = FormActivate
  OnClose = FormClose
  OnKeyUp = FormKeyUp
  PixelsPerInch = 96
  TextHeight = 13
  object bsRibbon1: TbsRibbon
    Left = 0
    Top = 0
    Width = 1263
    Height = 99
    HintImageIndex = 0
    TabOrder = 0
    SkinData = DM.bsSkinData1
    SkinDataName = 'officetab'
    Align = alTop
    Tabs = <
      item
        Page = bsArquivo
        Visible = True
      end
      item
        Page = bsRibbonPage2
        Visible = True
      end
      item
        Page = bsRibbonPage3
        Visible = True
      end
      item
        Page = bsRibbonPage4
        Visible = True
      end
      item
        Page = bsRibbonPage1
        Visible = True
      end>
    TabIndex = 0
    ActivePage = bsArquivo
    UseSkinFont = True
    AppButtonSpacing = 1
    AppButtonMargin = -1
    AppButtonWidth = 54
    AppButtonImageIndex = 0
    Buttons = <>
    ButtonsImageList = DM.ico_16x16
    ButtonsShowHint = False
    TabBoldStyle = False
    DesignSize = (
      1263
      99)
    object bsRibbonPage1: TbsRibbonPage
      Left = 1
      Top = 26
      Width = 1261
      Height = 70
      HotScroll = False
      ScrollOffset = 0
      ScrollTimerInterval = 50
      CanScroll = True
      Caption = 'Visualiza'#231#227'o'
      ExplicitWidth = 1076
      object bsRibbonGroup6: TbsRibbonGroup
        Left = 0
        Top = 0
        Width = 169
        Height = 70
        HintImageIndex = 0
        TabOrder = 0
        SkinData = DM.bsSkinData1
        SkinDataName = 'officegroup'
        DefaultFont.Charset = DEFAULT_CHARSET
        DefaultFont.Color = clWindowText
        DefaultFont.Height = 13
        DefaultFont.Name = 'Tahoma'
        DefaultFont.Style = []
        DefaultWidth = 0
        DefaultHeight = 0
        UseSkinFont = True
        Align = alLeft
        Caption = 'Resolu'#231#227'o'
        ShowDialogButton = False
        object btRes169: TbsSkinSpeedButton
          Tag = 169
          Left = 117
          Top = 2
          Width = 50
          Height = 49
          HintImageIndex = 0
          SkinData = DM.bsSkinData1
          SkinDataName = 'resizetoolbutton'
          DefaultFont.Charset = DEFAULT_CHARSET
          DefaultFont.Color = clWindowText
          DefaultFont.Height = 13
          DefaultFont.Name = 'Tahoma'
          DefaultFont.Style = []
          DefaultWidth = 0
          DefaultHeight = 0
          UseSkinFont = True
          CheckedMode = True
          ImageList = DM.ico_24x24
          UseSkinSize = True
          UseSkinFontColor = True
          WidthWithCaption = 0
          WidthWithoutCaption = 0
          ImageIndex = 104
          RepeatMode = False
          RepeatInterval = 100
          Transparent = True
          Flat = True
          AllowAllUp = False
          Down = False
          GroupIndex = -1
          Caption = '16:9'
          ShowCaption = True
          NumGlyphs = 1
          Align = alRight
          Spacing = 1
          Layout = blGlyphTop
          OnClick = btRes0Click
          ExplicitLeft = 189
        end
        object btRes0: TbsSkinSpeedButton
          Left = 2
          Top = 2
          Width = 65
          Height = 49
          HintImageIndex = 0
          SkinData = DM.bsSkinData1
          SkinDataName = 'resizetoolbutton'
          DefaultFont.Charset = DEFAULT_CHARSET
          DefaultFont.Color = clWindowText
          DefaultFont.Height = 13
          DefaultFont.Name = 'Tahoma'
          DefaultFont.Style = []
          DefaultWidth = 0
          DefaultHeight = 0
          UseSkinFont = True
          CheckedMode = True
          ImageList = DM.ico_24x24
          UseSkinSize = True
          UseSkinFontColor = True
          WidthWithCaption = 0
          WidthWithoutCaption = 0
          ImageIndex = 102
          RepeatMode = False
          RepeatInterval = 100
          Transparent = False
          Flat = True
          AllowAllUp = False
          Down = True
          GroupIndex = -1
          Caption = 'Tela Cheia'
          ShowCaption = True
          NumGlyphs = 1
          Align = alClient
          Spacing = 1
          Layout = blGlyphTop
          OnClick = btRes0Click
          ExplicitLeft = -4
        end
        object btRes43: TbsSkinSpeedButton
          Tag = 43
          Left = 67
          Top = 2
          Width = 50
          Height = 49
          HintImageIndex = 0
          SkinData = DM.bsSkinData1
          SkinDataName = 'resizetoolbutton'
          DefaultFont.Charset = DEFAULT_CHARSET
          DefaultFont.Color = clWindowText
          DefaultFont.Height = 13
          DefaultFont.Name = 'Tahoma'
          DefaultFont.Style = []
          DefaultWidth = 0
          DefaultHeight = 0
          UseSkinFont = True
          CheckedMode = True
          ImageList = DM.ico_24x24
          UseSkinSize = True
          UseSkinFontColor = True
          WidthWithCaption = 0
          WidthWithoutCaption = 0
          ImageIndex = 103
          RepeatMode = False
          RepeatInterval = 100
          Transparent = True
          Flat = True
          AllowAllUp = False
          Down = False
          GroupIndex = -1
          Caption = '4:3'
          ShowCaption = True
          NumGlyphs = 1
          Align = alRight
          Spacing = 1
          Layout = blGlyphTop
          OnClick = btRes0Click
          ExplicitLeft = 139
        end
      end
    end
    object bsRibbonPage4: TbsRibbonPage
      Left = 1
      Top = 26
      Width = 1261
      Height = 70
      HotScroll = False
      ScrollOffset = 0
      ScrollTimerInterval = 50
      CanScroll = True
      Caption = 'Formatar'
      ExplicitWidth = 1076
      ExplicitHeight = 68
      object bsRibbonGroup8: TbsRibbonGroup
        Left = 532
        Top = 0
        Width = 130
        Height = 70
        HintImageIndex = 0
        TabOrder = 2
        SkinData = DM.bsSkinData1
        SkinDataName = 'officegroup'
        DefaultFont.Charset = DEFAULT_CHARSET
        DefaultFont.Color = clWindowText
        DefaultFont.Height = 13
        DefaultFont.Name = 'Tahoma'
        DefaultFont.Style = []
        DefaultWidth = 0
        DefaultHeight = 0
        UseSkinFont = True
        Align = alLeft
        Caption = 'Texto Principal'
        ShowDialogButton = False
        object GridPanel1: TGridPanel
          Left = 2
          Top = 2
          Width = 126
          Height = 49
          Align = alClient
          BevelOuter = bvNone
          Caption = 'GridPanel1'
          ColumnCollection = <
            item
              Value = 50.000000000000000000
            end
            item
              Value = 50.000000000000000000
            end>
          ControlCollection = <
            item
              Column = 1
              Control = tamanhoLetra
              Row = 0
            end
            item
              Column = 1
              Control = corLetra
              Row = 1
            end
            item
              Column = 0
              Control = bsSkinStdLabel1
              Row = 0
            end
            item
              Column = 0
              Control = bsSkinStdLabel2
              Row = 1
            end>
          RowCollection = <
            item
              Value = 50.000000000000000000
            end
            item
              Value = 50.000000000000000000
            end>
          ShowCaption = False
          TabOrder = 0
          object tamanhoLetra: TbsSkinSpinEdit
            Tag = 9999
            AlignWithMargins = True
            Left = 63
            Top = 2
            Width = 63
            Height = 21
            Margins.Left = 0
            Margins.Top = 2
            Margins.Right = 0
            Margins.Bottom = 1
            HintImageIndex = 0
            TabOrder = 0
            SkinData = DM.bsSkinData1
            SkinDataName = 'spinedit'
            DefaultFont.Charset = DEFAULT_CHARSET
            DefaultFont.Color = clWindowText
            DefaultFont.Height = 13
            DefaultFont.Name = 'Tahoma'
            DefaultFont.Style = []
            DefaultWidth = 0
            DefaultHeight = 0
            UseSkinFont = True
            DefaultColor = clWindow
            UseSkinSize = True
            ValueType = vtInteger
            Align = alClient
            Increment = 1.000000000000000000
            EditorEnabled = True
            MaxLength = 0
            OnChange = tamanhoLetraChange
          end
          object corLetra: TbsSkinColorButton
            AlignWithMargins = True
            Left = 63
            Top = 25
            Width = 63
            Height = 21
            Hint = 'Cor da Fonte'
            Margins.Left = 0
            Margins.Top = 1
            Margins.Right = 0
            HintImageIndex = 0
            SkinData = DM.bsSkinData1
            SkinDataName = 'toolmenubutton'
            DefaultFont.Charset = DEFAULT_CHARSET
            DefaultFont.Color = clWindowText
            DefaultFont.Height = 13
            DefaultFont.Name = 'Tahoma'
            DefaultFont.Style = []
            DefaultWidth = 0
            DefaultHeight = 0
            UseSkinFont = True
            CheckedMode = False
            ImageList = DM.ico_16x16
            UseSkinSize = False
            UseSkinFontColor = True
            WidthWithCaption = 0
            WidthWithoutCaption = 0
            ImageIndex = 50
            RepeatMode = False
            RepeatInterval = 100
            Transparent = False
            Flat = False
            AllowAllUp = False
            ShowHint = False
            ParentShowHint = False
            Down = False
            GroupIndex = 0
            ShowCaption = True
            NumGlyphs = 1
            Align = alClient
            Spacing = 1
            NewStyle = False
            TrackPosition = bstpRight
            UseImagesMenuImage = False
            UseImagesMenuCaption = False
            TrackButtonMode = False
            AutoColor = clBlack
            ColorValue = clBlack
            ShowAutoColor = True
            ShowMoreColor = True
            MenuUseSkinFont = True
            MenuDefaultFont.Charset = DEFAULT_CHARSET
            MenuDefaultFont.Color = clWindowText
            MenuDefaultFont.Height = 13
            MenuDefaultFont.Name = 'Tahoma'
            MenuDefaultFont.Style = []
            MenuAlphaBlend = False
            MenuAlphaBlendValue = 200
            MenuAlphaBlendAnimation = False
            OnChangeColor = corLetraChangeColor
            ExplicitLeft = 64
            ExplicitTop = 24
            ExplicitHeight = 22
          end
          object bsSkinStdLabel1: TbsSkinStdLabel
            Left = 0
            Top = 0
            Width = 63
            Height = 24
            EllipsType = bsetNone
            UseSkinFont = True
            UseSkinColor = True
            DefaultFont.Charset = DEFAULT_CHARSET
            DefaultFont.Color = clWindowText
            DefaultFont.Height = 13
            DefaultFont.Name = 'Tahoma'
            DefaultFont.Style = []
            SkinData = DM.bsSkinData1
            SkinDataName = 'stdlabel'
            Align = alClient
            AutoSize = False
            Caption = 'Tamanho:'
            Layout = tlCenter
            ExplicitLeft = 8
            ExplicitTop = 8
            ExplicitHeight = 23
          end
          object bsSkinStdLabel2: TbsSkinStdLabel
            Left = 0
            Top = 24
            Width = 63
            Height = 25
            EllipsType = bsetNone
            UseSkinFont = True
            UseSkinColor = True
            DefaultFont.Charset = DEFAULT_CHARSET
            DefaultFont.Color = clWindowText
            DefaultFont.Height = 13
            DefaultFont.Name = 'Tahoma'
            DefaultFont.Style = []
            SkinData = DM.bsSkinData1
            SkinDataName = 'stdlabel'
            Align = alClient
            AutoSize = False
            Caption = 'Cor:'
            Layout = tlCenter
            ExplicitLeft = 8
            ExplicitTop = 23
            ExplicitHeight = 24
          end
        end
      end
      object bsRibbonGroup9: TbsRibbonGroup
        Left = 0
        Top = 0
        Width = 295
        Height = 70
        HintImageIndex = 0
        TabOrder = 0
        SkinData = DM.bsSkinData1
        SkinDataName = 'officegroup'
        DefaultFont.Charset = DEFAULT_CHARSET
        DefaultFont.Color = clWindowText
        DefaultFont.Height = 13
        DefaultFont.Name = 'Tahoma'
        DefaultFont.Style = []
        DefaultWidth = 0
        DefaultHeight = 0
        UseSkinFont = True
        Align = alLeft
        Caption = 'Fundo'
        ShowDialogButton = False
        object bsSkinSpeedButton6: TbsSkinSpeedButton
          Tag = 1
          Left = 2
          Top = 2
          Width = 49
          Height = 49
          HintImageIndex = 0
          SkinData = DM.bsSkinData1
          SkinDataName = 'resizetoolbutton'
          DefaultFont.Charset = DEFAULT_CHARSET
          DefaultFont.Color = clWindowText
          DefaultFont.Height = 13
          DefaultFont.Name = 'Tahoma'
          DefaultFont.Style = []
          DefaultWidth = 0
          DefaultHeight = 0
          UseSkinFont = True
          CheckedMode = False
          ImageList = DM.ico_24x24
          UseSkinSize = True
          UseSkinFontColor = True
          WidthWithCaption = 0
          WidthWithoutCaption = 0
          ImageIndex = 105
          RepeatMode = False
          RepeatInterval = 100
          Transparent = True
          Flat = True
          AllowAllUp = False
          Down = False
          GroupIndex = 0
          Caption = 'Imagem'
          ShowCaption = True
          NumGlyphs = 1
          Align = alLeft
          Spacing = 1
          Layout = blGlyphTop
          OnClick = bsSkinSpeedButton6Click
        end
        object btRemoveImagem: TbsSkinSpeedButton
          Tag = 1
          Left = 51
          Top = 2
          Width = 98
          Height = 49
          HintImageIndex = 0
          SkinData = DM.bsSkinData1
          SkinDataName = 'resizetoolbutton'
          DefaultFont.Charset = DEFAULT_CHARSET
          DefaultFont.Color = clWindowText
          DefaultFont.Height = 13
          DefaultFont.Name = 'Tahoma'
          DefaultFont.Style = []
          DefaultWidth = 0
          DefaultHeight = 0
          UseSkinFont = True
          CheckedMode = False
          ImageList = DM.ico_24x24
          UseSkinSize = True
          UseSkinFontColor = True
          WidthWithCaption = 0
          WidthWithoutCaption = 0
          ImageIndex = 106
          RepeatMode = False
          RepeatInterval = 100
          Transparent = True
          Flat = True
          AllowAllUp = False
          Down = False
          GroupIndex = 0
          Caption = 'Remover Imagem'
          ShowCaption = True
          NumGlyphs = 1
          Align = alLeft
          Spacing = 1
          Layout = blGlyphTop
          OnClick = btRemoveImagemClick
        end
        object GridPanel4: TGridPanel
          Left = 149
          Top = 2
          Width = 144
          Height = 49
          Align = alClient
          BevelOuter = bvNone
          Caption = 'GridPanel1'
          ColumnCollection = <
            item
              SizeStyle = ssAbsolute
              Value = 50.000000000000000000
            end
            item
              Value = 100.000000000000000000
            end>
          ControlCollection = <
            item
              Column = 0
              Control = bsSkinStdLabel8
              Row = 1
            end
            item
              Column = 1
              Control = posicaoFundo
              Row = 1
            end
            item
              Column = 0
              Control = bsSkinStdLabel9
              Row = 3
            end
            item
              Column = 1
              Control = corFundo
              Row = 3
            end>
          RowCollection = <
            item
              Value = 33.500835743511700000
            end
            item
              SizeStyle = ssAbsolute
              Value = 20.000000000000000000
            end
            item
              Value = 33.333056212927030000
            end
            item
              SizeStyle = ssAbsolute
              Value = 20.000000000000000000
            end
            item
              Value = 33.166108043561270000
            end>
          ShowCaption = False
          TabOrder = 0
          DesignSize = (
            144
            49)
          object bsSkinStdLabel8: TbsSkinStdLabel
            Left = 0
            Top = 3
            Width = 50
            Height = 20
            EllipsType = bsetNone
            UseSkinFont = True
            UseSkinColor = True
            DefaultFont.Charset = DEFAULT_CHARSET
            DefaultFont.Color = clWindowText
            DefaultFont.Height = 13
            DefaultFont.Name = 'Tahoma'
            DefaultFont.Style = []
            SkinData = DM.bsSkinData1
            SkinDataName = 'stdlabel'
            Align = alClient
            AutoSize = False
            Caption = 'Posi'#231#227'o:'
            Layout = tlCenter
            ExplicitLeft = 8
            ExplicitTop = 23
            ExplicitWidth = 63
            ExplicitHeight = 24
          end
          object posicaoFundo: TbsSkinComboBoxEx
            Tag = 9999
            Left = 50
            Top = 3
            Width = 94
            Height = 20
            Margins.Left = 0
            Margins.Top = 1
            Margins.Right = 0
            HintImageIndex = 0
            Anchors = [akLeft, akTop, akRight, akBottom]
            TabOrder = 0
            SkinData = DM.bsSkinData1
            SkinDataName = 'combobox'
            DefaultFont.Charset = DEFAULT_CHARSET
            DefaultFont.Color = clWindowText
            DefaultFont.Height = 13
            DefaultFont.Name = 'Tahoma'
            DefaultFont.Style = []
            DefaultWidth = 0
            DefaultHeight = 0
            UseSkinFont = True
            UseSkinSize = False
            ToolButtonStyle = False
            ItemsEx = <
              item
                Caption = 'Topo Esq.'
                ImageIndex = 92
                SelectedImageIndex = 92
              end
              item
                Caption = 'Topo'
                ImageIndex = 93
                SelectedImageIndex = 93
              end
              item
                Caption = 'Topo Dir.'
                ImageIndex = 94
                SelectedImageIndex = 94
              end
              item
                Caption = 'Centro Esq.'
                ImageIndex = 95
                SelectedImageIndex = 95
              end
              item
                Caption = 'Centro'
                ImageIndex = 96
                SelectedImageIndex = 96
              end
              item
                Caption = 'Centro Dir.'
                ImageIndex = 97
                SelectedImageIndex = 97
              end
              item
                Caption = 'Rodap'#233' Esq.'
                ImageIndex = 98
                SelectedImageIndex = 98
              end
              item
                Caption = 'Rodap'#233
                ImageIndex = 99
                SelectedImageIndex = 99
              end
              item
                Caption = 'Rodap'#233' Dir.'
                ImageIndex = 100
                SelectedImageIndex = 100
              end>
            Style = bscbFixedStyle
            HideSelection = True
            AutoComplete = True
            ListBoxUseSkinFont = True
            ListBoxUseSkinItemHeight = True
            ListBoxWidth = 0
            Images = DM.ico_16x16
            AlphaBlend = False
            AlphaBlendValue = 0
            AlphaBlendAnimation = False
            ListBoxCaptionMode = False
            ListBoxDefaultFont.Charset = DEFAULT_CHARSET
            ListBoxDefaultFont.Color = clWindowText
            ListBoxDefaultFont.Height = 13
            ListBoxDefaultFont.Name = 'Tahoma'
            ListBoxDefaultFont.Style = []
            ListBoxDefaultCaptionFont.Charset = DEFAULT_CHARSET
            ListBoxDefaultCaptionFont.Color = clWindowText
            ListBoxDefaultCaptionFont.Height = 13
            ListBoxDefaultCaptionFont.Name = 'Tahoma'
            ListBoxDefaultCaptionFont.Style = []
            ListBoxDefaultItemHeight = 20
            ListBoxCaptionAlignment = taLeftJustify
            DropDownCount = 8
            Font.Charset = DEFAULT_CHARSET
            Font.Color = clWindowText
            Font.Height = 13
            Font.Name = 'Tahoma'
            Font.Style = []
            OnClick = posicaoFundoClick
          end
          object bsSkinStdLabel9: TbsSkinStdLabel
            Left = 0
            Top = 25
            Width = 50
            Height = 20
            Margins.Left = 5
            Margins.Top = 0
            Margins.Right = 0
            Margins.Bottom = 0
            EllipsType = bsetNone
            UseSkinFont = True
            UseSkinColor = True
            DefaultFont.Charset = DEFAULT_CHARSET
            DefaultFont.Color = clWindowText
            DefaultFont.Height = 13
            DefaultFont.Name = 'Tahoma'
            DefaultFont.Style = []
            SkinData = DM.bsSkinData1
            SkinDataName = 'stdlabel'
            Align = alClient
            AutoSize = False
            Caption = ' Cor:'
            Layout = tlCenter
            ExplicitLeft = 8
            ExplicitTop = 28
            ExplicitWidth = 3
            ExplicitHeight = 13
          end
          object corFundo: TbsSkinColorButton
            Tag = 19
            Left = 50
            Top = 25
            Width = 94
            Height = 20
            Margins.Left = 0
            Margins.Top = 1
            Margins.Right = 0
            HintImageIndex = 0
            SkinData = DM.bsSkinData1
            SkinDataName = 'toolmenubutton'
            DefaultFont.Charset = DEFAULT_CHARSET
            DefaultFont.Color = clWindowText
            DefaultFont.Height = 13
            DefaultFont.Name = 'Tahoma'
            DefaultFont.Style = []
            DefaultWidth = 0
            DefaultHeight = 0
            UseSkinFont = True
            CheckedMode = False
            UseSkinSize = False
            UseSkinFontColor = True
            WidthWithCaption = 0
            WidthWithoutCaption = 0
            ImageIndex = 0
            RepeatMode = False
            RepeatInterval = 100
            Transparent = False
            Flat = False
            AllowAllUp = False
            Down = False
            GroupIndex = 0
            ShowCaption = True
            NumGlyphs = 1
            Align = alClient
            Spacing = 1
            NewStyle = False
            TrackPosition = bstpRight
            UseImagesMenuImage = False
            UseImagesMenuCaption = False
            TrackButtonMode = False
            AutoColor = clBlack
            ColorValue = clBlack
            ShowAutoColor = True
            ShowMoreColor = True
            MenuUseSkinFont = True
            MenuDefaultFont.Charset = DEFAULT_CHARSET
            MenuDefaultFont.Color = clWindowText
            MenuDefaultFont.Height = 13
            MenuDefaultFont.Name = 'Tahoma'
            MenuDefaultFont.Style = []
            MenuAlphaBlend = False
            MenuAlphaBlendValue = 200
            MenuAlphaBlendAnimation = False
            OnChangeColor = corFundoChangeColor
            ExplicitLeft = 205
            ExplicitWidth = 50
            ExplicitHeight = 21
          end
        end
      end
      object bsRibbonGroup12: TbsRibbonGroup
        Left = 662
        Top = 0
        Width = 130
        Height = 70
        HintImageIndex = 0
        TabOrder = 3
        SkinData = DM.bsSkinData1
        SkinDataName = 'officegroup'
        DefaultFont.Charset = DEFAULT_CHARSET
        DefaultFont.Color = clWindowText
        DefaultFont.Height = 13
        DefaultFont.Name = 'Tahoma'
        DefaultFont.Style = []
        DefaultWidth = 0
        DefaultHeight = 0
        UseSkinFont = True
        Align = alLeft
        Caption = 'Texto Auxiliar'
        ShowDialogButton = False
        object GridPanel3: TGridPanel
          Left = 2
          Top = 2
          Width = 126
          Height = 49
          Align = alClient
          BevelOuter = bvNone
          Caption = 'GridPanel1'
          ColumnCollection = <
            item
              Value = 50.000000000000000000
            end
            item
              Value = 50.000000000000000000
            end>
          ControlCollection = <
            item
              Column = 1
              Control = tamanhoLetra_aux
              Row = 0
            end
            item
              Column = 0
              Control = bsSkinStdLabel3
              Row = 0
            end
            item
              Column = 0
              Control = bsSkinStdLabel4
              Row = 1
            end
            item
              Column = 1
              Control = corLetra_aux
              Row = 1
            end>
          RowCollection = <
            item
              Value = 50.000000000000000000
            end
            item
              Value = 50.000000000000000000
            end>
          ShowCaption = False
          TabOrder = 0
          object tamanhoLetra_aux: TbsSkinSpinEdit
            Tag = 9999
            AlignWithMargins = True
            Left = 63
            Top = 2
            Width = 63
            Height = 21
            Margins.Left = 0
            Margins.Top = 2
            Margins.Right = 0
            Margins.Bottom = 1
            HintImageIndex = 0
            TabOrder = 0
            SkinData = DM.bsSkinData1
            SkinDataName = 'spinedit'
            DefaultFont.Charset = DEFAULT_CHARSET
            DefaultFont.Color = clWindowText
            DefaultFont.Height = 13
            DefaultFont.Name = 'Tahoma'
            DefaultFont.Style = []
            DefaultWidth = 0
            DefaultHeight = 0
            UseSkinFont = True
            DefaultColor = clWindow
            UseSkinSize = True
            ValueType = vtInteger
            Align = alClient
            Increment = 1.000000000000000000
            EditorEnabled = True
            MaxLength = 0
            OnChange = tamanhoLetra_auxChange
          end
          object bsSkinStdLabel3: TbsSkinStdLabel
            Left = 0
            Top = 0
            Width = 63
            Height = 24
            EllipsType = bsetNone
            UseSkinFont = True
            UseSkinColor = True
            DefaultFont.Charset = DEFAULT_CHARSET
            DefaultFont.Color = clWindowText
            DefaultFont.Height = 13
            DefaultFont.Name = 'Tahoma'
            DefaultFont.Style = []
            SkinData = DM.bsSkinData1
            SkinDataName = 'stdlabel'
            Align = alClient
            AutoSize = False
            Caption = 'Tamanho:'
            Layout = tlCenter
            ExplicitHeight = 23
          end
          object bsSkinStdLabel4: TbsSkinStdLabel
            Left = 0
            Top = 24
            Width = 63
            Height = 25
            EllipsType = bsetNone
            UseSkinFont = True
            UseSkinColor = True
            DefaultFont.Charset = DEFAULT_CHARSET
            DefaultFont.Color = clWindowText
            DefaultFont.Height = 13
            DefaultFont.Name = 'Tahoma'
            DefaultFont.Style = []
            SkinData = DM.bsSkinData1
            SkinDataName = 'stdlabel'
            Align = alClient
            AutoSize = False
            Caption = 'Cor:'
            Layout = tlCenter
            ExplicitTop = 23
            ExplicitHeight = 24
          end
          object corLetra_aux: TbsSkinColorButton
            AlignWithMargins = True
            Left = 63
            Top = 25
            Width = 63
            Height = 21
            Hint = 'Cor da Fonte'
            Margins.Left = 0
            Margins.Top = 1
            Margins.Right = 0
            HintImageIndex = 0
            SkinData = DM.bsSkinData1
            SkinDataName = 'toolmenubutton'
            DefaultFont.Charset = DEFAULT_CHARSET
            DefaultFont.Color = clWindowText
            DefaultFont.Height = 13
            DefaultFont.Name = 'Tahoma'
            DefaultFont.Style = []
            DefaultWidth = 0
            DefaultHeight = 0
            UseSkinFont = True
            CheckedMode = False
            ImageList = DM.ico_16x16
            UseSkinSize = False
            UseSkinFontColor = True
            WidthWithCaption = 0
            WidthWithoutCaption = 0
            ImageIndex = 50
            RepeatMode = False
            RepeatInterval = 100
            Transparent = False
            Flat = False
            AllowAllUp = False
            ShowHint = False
            ParentShowHint = False
            Down = False
            GroupIndex = 0
            ShowCaption = True
            NumGlyphs = 1
            Align = alClient
            Spacing = 1
            NewStyle = False
            TrackPosition = bstpRight
            UseImagesMenuImage = False
            UseImagesMenuCaption = False
            TrackButtonMode = False
            AutoColor = clBlack
            ColorValue = clBlack
            ShowAutoColor = True
            ShowMoreColor = True
            MenuUseSkinFont = True
            MenuDefaultFont.Charset = DEFAULT_CHARSET
            MenuDefaultFont.Color = clWindowText
            MenuDefaultFont.Height = 13
            MenuDefaultFont.Name = 'Tahoma'
            MenuDefaultFont.Style = []
            MenuAlphaBlend = False
            MenuAlphaBlendValue = 200
            MenuAlphaBlendAnimation = False
            OnChangeColor = corLetra_auxChangeColor
            ExplicitLeft = 6
            ExplicitTop = 31
            ExplicitWidth = 25
            ExplicitHeight = 24
          end
        end
      end
      object bsRibbonGroup13: TbsRibbonGroup
        Left = 295
        Top = 0
        Width = 237
        Height = 70
        HintImageIndex = 0
        TabOrder = 1
        SkinData = DM.bsSkinData1
        SkinDataName = 'officegroup'
        DefaultFont.Charset = DEFAULT_CHARSET
        DefaultFont.Color = clWindowText
        DefaultFont.Height = 13
        DefaultFont.Name = 'Tahoma'
        DefaultFont.Style = []
        DefaultWidth = 0
        DefaultHeight = 0
        UseSkinFont = True
        Align = alLeft
        Caption = 'Replicar Fundo'
        ShowDialogButton = False
        object bsSkinSpeedButton2: TbsSkinSpeedButton
          Tag = 3
          Left = 164
          Top = 2
          Width = 71
          Height = 49
          HintImageIndex = 0
          SkinData = DM.bsSkinData1
          SkinDataName = 'resizetoolbutton'
          DefaultFont.Charset = DEFAULT_CHARSET
          DefaultFont.Color = clWindowText
          DefaultFont.Height = 13
          DefaultFont.Name = 'Tahoma'
          DefaultFont.Style = []
          DefaultWidth = 0
          DefaultHeight = 0
          UseSkinFont = True
          CheckedMode = False
          ImageList = DM.ico_24x24
          UseSkinSize = True
          UseSkinFontColor = True
          WidthWithCaption = 0
          WidthWithoutCaption = 0
          ImageIndex = 87
          RepeatMode = False
          RepeatInterval = 100
          Transparent = True
          Flat = True
          AllowAllUp = False
          Down = False
          GroupIndex = 0
          Caption = 'Todos Slides'
          ShowCaption = True
          NumGlyphs = 1
          Align = alRight
          Spacing = 1
          Layout = blGlyphTop
          OnClick = replicaFormatacaoFundo
          ExplicitLeft = 2
          ExplicitHeight = 47
        end
        object bsSkinSpeedButton8: TbsSkinSpeedButton
          Tag = 1
          Left = 2
          Top = 2
          Width = 77
          Height = 49
          HintImageIndex = 0
          SkinData = DM.bsSkinData1
          SkinDataName = 'resizetoolbutton'
          DefaultFont.Charset = DEFAULT_CHARSET
          DefaultFont.Color = clWindowText
          DefaultFont.Height = 13
          DefaultFont.Name = 'Tahoma'
          DefaultFont.Style = []
          DefaultWidth = 0
          DefaultHeight = 0
          UseSkinFont = True
          CheckedMode = False
          ImageList = DM.ico_24x24
          UseSkinSize = True
          UseSkinFontColor = True
          WidthWithCaption = 0
          WidthWithoutCaption = 0
          ImageIndex = 85
          RepeatMode = False
          RepeatInterval = 100
          Transparent = True
          Flat = True
          AllowAllUp = False
          Down = False
          GroupIndex = 0
          Caption = 'Slide Seguinte'
          ShowCaption = True
          NumGlyphs = 1
          Align = alLeft
          Spacing = 1
          Layout = blGlyphTop
          OnClick = replicaFormatacaoFundo
        end
        object bsSkinSpeedButton10: TbsSkinSpeedButton
          Tag = 2
          Left = 79
          Top = 2
          Width = 85
          Height = 49
          HintImageIndex = 0
          SkinData = DM.bsSkinData1
          SkinDataName = 'resizetoolbutton'
          DefaultFont.Charset = DEFAULT_CHARSET
          DefaultFont.Color = clWindowText
          DefaultFont.Height = 13
          DefaultFont.Name = 'Tahoma'
          DefaultFont.Style = []
          DefaultWidth = 0
          DefaultHeight = 0
          UseSkinFont = True
          CheckedMode = False
          ImageList = DM.ico_24x24
          UseSkinSize = True
          UseSkinFontColor = True
          WidthWithCaption = 0
          WidthWithoutCaption = 0
          ImageIndex = 86
          RepeatMode = False
          RepeatInterval = 100
          Transparent = True
          Flat = True
          AllowAllUp = False
          Down = False
          GroupIndex = 0
          Caption = 'Todos Seguintes'
          ShowCaption = True
          NumGlyphs = 1
          Align = alClient
          Spacing = 1
          Layout = blGlyphTop
          OnClick = replicaFormatacaoFundo
          ExplicitLeft = 73
          ExplicitWidth = 80
          ExplicitHeight = 47
        end
      end
      object bsRibbonGroup14: TbsRibbonGroup
        Left = 922
        Top = 0
        Width = 237
        Height = 70
        HintImageIndex = 0
        TabOrder = 5
        SkinData = DM.bsSkinData1
        SkinDataName = 'officegroup'
        DefaultFont.Charset = DEFAULT_CHARSET
        DefaultFont.Color = clWindowText
        DefaultFont.Height = 13
        DefaultFont.Name = 'Tahoma'
        DefaultFont.Style = []
        DefaultWidth = 0
        DefaultHeight = 0
        UseSkinFont = True
        Align = alLeft
        Caption = 'Replicar Formata'#231#227'o de Texto'
        ShowDialogButton = False
        object bsSkinSpeedButton17: TbsSkinSpeedButton
          Tag = 3
          Left = 164
          Top = 2
          Width = 71
          Height = 49
          HintImageIndex = 0
          SkinData = DM.bsSkinData1
          SkinDataName = 'resizetoolbutton'
          DefaultFont.Charset = DEFAULT_CHARSET
          DefaultFont.Color = clWindowText
          DefaultFont.Height = 13
          DefaultFont.Name = 'Tahoma'
          DefaultFont.Style = []
          DefaultWidth = 0
          DefaultHeight = 0
          UseSkinFont = True
          CheckedMode = False
          ImageList = DM.ico_24x24
          UseSkinSize = True
          UseSkinFontColor = True
          WidthWithCaption = 0
          WidthWithoutCaption = 0
          ImageIndex = 90
          RepeatMode = False
          RepeatInterval = 100
          Transparent = True
          Flat = True
          AllowAllUp = False
          Down = False
          GroupIndex = 0
          Caption = 'Todos Slides'
          ShowCaption = True
          NumGlyphs = 1
          Align = alRight
          Spacing = 1
          Layout = blGlyphTop
          OnClick = replicaFormatacaoTexto
