import React, {useRef, useState, FC, useEffect, useCallback} from 'react';
import useResize from 'react-resize-observer-hook';
import {Pane} from './pane';
import styled from 'styled-components';
import {KeyboardValue} from '../../utils/keyboard-api';
import {anyKeycodeToString} from '../../utils/advanced-keys';
import {MusicalKeySlider} from '../inputs/musical-key-slider';
import {AccentSelect} from '../inputs/accent-select';
import {AccentButton} from '../inputs/accent-button';
import {AccentSlider} from '../inputs/accent-slider';
import {ArrayColorPicker} from '../inputs/color-picker';
import {PelpiKeycodeInput} from '../inputs/pelpi/keycode-input';
import {BlankPositionedKeyboard, getNextKey} from '../positioned-keyboard';
import {getKLEFiles, authGithub, getUser} from '../../utils/github';
import {
  ControlRow,
  Label,
  SubLabel,
  Detail,
  IndentedControlRow,
  OverflowCell,
  FlexCell,
} from './grid';
import Layouts from '../Layouts';
import type {VIADefinitionV2, VIADefinitionV3} from 'via-reader';
import {AccentRange} from '../inputs/accent-range';
import {useAppSelector} from 'src/store/hooks';
import {
  getConnectedDevices,
  getSelectedConnectedDevice,
} from 'src/store/devicesSlice';
import {
  getBaseDefinitions,
  getDefinitions,
  getCustomDefinitions,
  getBasicKeyToByte,
} from 'src/store/definitionsSlice';
import TextInput from '../inputs/text-input';

// TODO: should we differentiate between firwmare versions in the UI?
type KeyboardDefinitionEntry = [string, VIADefinitionV2 | VIADefinitionV3];

const Container = styled.div`
  display: flex;
  align-items: center;
  flex-direction: column;
  padding: 0 12px;
`;

const DebugPane = styled(Pane)`
  height: 100%;
  max-width: 100vw;

  @media (min-width: 1200px) {
    flex-direction: row;
  }
`;

const MenuPanel = styled(OverflowCell)`
  flex: 1;
  padding: 1rem;

  @media (min-width: 1200px) {
    border: 0 none;
    border-left: 1px solid var(--color_dark-grey);
    max-width: 33rem;
    padding: 1.5rem;
  }
`;

const KeyboardPanel = styled(FlexCell)`
  flex: 1;

  @media (min-width: 1200px) {
    border: 0 none;
    box-sizing: border-box;
    height: 100%;
  }
`;

const ControlGroup = styled.div`
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  width: 100%;

  &:last-child {
    padding-bottom: 0;
  }
`;

const ControlGroupHeader = styled.div`
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  margin-bottom: 0.5rem;
`;

const GithubUserData = () => {
  const [userData, setUserData] = useState<{
    login: string;
    avatar_url: string;
  }>();
  const clickLogin = useCallback(async () => {
    await authGithub();
    const userData = await getUser();
    setUserData(userData);
  }, []);
  // Attempt first
  useEffect(() => {
    (async () => {
      const userData = await getUser();
      setUserData(userData);
    })();
  }, []);
  return (
    <ControlGroup>
      <ControlGroupHeader>GH Integration</ControlGroupHeader>
      {userData && (
        <ControlRow>
          <Label>{userData.login}</Label>
          <Detail>
            <img src={userData.avatar_url} width={40} height={40} />
          </Detail>
        </ControlRow>
      )}
      {!userData && (
        <ControlRow>
          <Label>Login</Label>
          <Detail>
            <AccentButton onClick={clickLogin}>OAuth me</AccentButton>
          </Detail>
        </ControlRow>
      )}
    </ControlGroup>
  );
};

const TestControls = () => {
  const [isChecked, setIsChecked] = useState(true);
  const [rangeVal, setRangeVal] = useState(0);
  const [colorVal, setColorVal] = useState<[number, number]>([0, 0]);
  const [selectionVal, setSelectionVal] = useState(0);
  const [keycode, setKeycode] = useState(0);
  const {basicKeyToByte, byteToKey} = useAppSelector(getBasicKeyToByte);
  const selectOptions = [
    {label: 'Option 1', value: '0'},
    {label: 'Option 2', value: '1'},
  ];

  return (
    <ControlGroup>
      <ControlGroupHeader>Controls</ControlGroupHeader>
      <ControlRow>
        <Label>Text Input</Label>
        <Detail>
          <TextInput />
        </Detail>
      </ControlRow>
      <ControlRow>
        <Label>
          {keycode} / {anyKeycodeToString(keycode, basicKeyToByte, byteToKey)}
        </Label>
        <Detail>
          <PelpiKeycodeInput value={keycode} setValue={setKeycode} meta={{}} />
        </Detail>
      </ControlRow>
      <ControlRow>
        <Label>
          {colorVal[0]}, {colorVal[1]}
        </Label>
        <Detail>
          <ArrayColorPicker
            color={colorVal}
            setColor={(hue, sat) => setColorVal([hue, sat])}
          />
        </Detail>
      </ControlRow>
      <ControlRow>
        <Label>{rangeVal}</Label>
        <Detail>
          <AccentRange
            max={100}
            min={0}
            defaultValue={rangeVal}
            onChange={setRangeVal}
          />
        </Detail>
      </ControlRow>
      <ControlRow>
        <Label>{+isChecked}</Label>
        <Detail>
          <AccentSlider isChecked={isChecked} onChange={setIsChecked} />
        </Detail>
      </ControlRow>
      <ControlRow>
        <Label>{+selectionVal}</Label>
        <Detail>
          <AccentSelect
            defaultValue={selectOptions[selectionVal]}
            options={selectOptions}
            onChange={(option) => {
              option && setSelectionVal(+option.value);
            }}
          />
        </Detail>
      </ControlRow>
    </ControlGroup>
  );
};

export const Debug: FC = () => {
  const selectedDevice = useAppSelector(getSelectedConnectedDevice);
  const api = selectedDevice ? selectedDevice.api : null;
  const connectedDevices = useAppSelector(getConnectedDevices);

  // Temporary patch that gets the page to load
  // TODO: We probably need to rethink this + design a bit. Loading defs in design causes this to crash
  const allDefinitions = Object.entries(useAppSelector(getDefinitions))
    .flatMap(([id, versionMap]): KeyboardDefinitionEntry[] => [
      [id, versionMap.v2] as KeyboardDefinitionEntry,
      [id, versionMap.v3] as KeyboardDefinitionEntry,
    ])
    .filter(([_, definition]) => definition !== undefined);

  const remoteDefinitions = Object.entries(useAppSelector(getBaseDefinitions))
    .flatMap(([id, versionMap]): KeyboardDefinitionEntry[] => [
      [id, versionMap.v2] as KeyboardDefinitionEntry,
      [id, versionMap.v3] as KeyboardDefinitionEntry,
    ])
    .filter(([_, definition]) => definition !== undefined);

  const localDefinitions = Object.entries(useAppSelector(getCustomDefinitions))
    .flatMap(([id, versionMap]): KeyboardDefinitionEntry[] => [
      [id, versionMap.v2] as KeyboardDefinitionEntry,
      [id, versionMap.v3] as KeyboardDefinitionEntry,
    ])
    .filter(([_, definition]) => definition !== undefined);

  const [selectedDefinitionIndex, setSelectedDefinition] = useState(0);
  const [selectedOptionKeys, setSelectedOptionKeys] = useState<number[]>([]);
  const [selectedKey, setSelectedKey] = useState<undefined | number>(0);
  const [showMatrix, setShowMatrix] = useState(false);
  const [dimensions, setDimensions] = useState({
    width: 1280,
    height: 900,
  });

  const options = allDefinitions.map(([, definition], index) => ({
    label: definition.name,
    value: `${index}`,
  }));
  const entry = allDefinitions[selectedDefinitionIndex];

  const flexRef = useRef(null);
  useResize(
    flexRef,
    (entry) =>
      flexRef.current &&
      setDimensions({
        width: entry.width,
        height: entry.height,
      }),
  );

  return (
    <DebugPane>
      <KeyboardPanel ref={flexRef}>
        {entry && (
          <BlankPositionedKeyboard
            containerDimensions={dimensions}
            selectedDefinition={entry[1]}
            showMatrix={showMatrix}
            selectedOptionKeys={selectedOptionKeys}
            selectedKey={selectedKey}
          />
        )}
      </KeyboardPanel>
      <MenuPanel>
        <Container>
          <GithubUserData />
          <ControlGroup>
            <ControlGroupHeader>Key Testing</ControlGroupHeader>
            <ControlRow>
              <Label>Key sounds</Label>
              <Detail>
                <MusicalKeySlider />
              </Detail>
            </ControlRow>
            <ControlRow>
              <Label>Show Matrix</Label>
              <Detail>
                <AccentSlider
                  isChecked={showMatrix}
                  onChange={(val) => setShowMatrix(val)}
                />
              </Detail>
            </ControlRow>
            <ControlRow>
              <Label>Set next key</Label>
              <Detail>
                <AccentButton
                  onClick={() => {
                    const {keys, optionKeys} = entry[1].layouts;
                    const selectedOptionKeys = optionKeys
                      ? Object.entries(optionKeys).flatMap(
                          ([key, options]) => options[0],
                        )
                      : [];
                    const displayedKeys = [...keys, ...selectedOptionKeys];
                    if (selectedKey !== undefined) {
                      setSelectedKey(
                        getNextKey(selectedKey, displayedKeys) ?? undefined,
                      );
                    }
                  }}
                >
                  Next
                </AccentButton>
              </Detail>
            </ControlRow>
          </ControlGroup>
          {options && (
            <ControlGroup>
              <ControlGroupHeader>Layout Testing</ControlGroupHeader>
              <ControlRow>
                <Label>Dummy Keyboard</Label>
                <Detail>
                  <AccentSelect
                    onChange={(option) =>
                      option && setSelectedDefinition(+option.value)
                    }
                    defaultValue={options[0]}
                    options={options}
                  />
                </Detail>
              </ControlRow>
            </ControlGroup>
          )}
          {entry && (
            <Layouts
              definition={entry[1]}
              onLayoutChange={(newSelectedOptionKeys) => {
                setSelectedOptionKeys(newSelectedOptionKeys);
              }}
            />
          )}
          {api && (
            <ControlGroup>
              <ControlGroupHeader>
                Connected Device Debugging
              </ControlGroupHeader>
              <ControlRow>
                <Label>EEPROM Reset</Label>
                <Detail>
                  <AccentButton onClick={() => api.resetEEPROM()}>
                    Reset
                  </AccentButton>
                </Detail>
              </ControlRow>
              <ControlRow>
                <Label>Bootloader Jump</Label>
                <Detail>
                  <AccentButton onClick={() => api.jumpToBootloader()}>
                    Jump
                  </AccentButton>
                </Detail>
              </ControlRow>
              <ControlRow>
                <Label>Clear all macros</Label>
                <Detail>
                  <AccentButton onClick={() => api.resetMacros()}>
                    Clear
                  </AccentButton>
                </Detail>
              </ControlRow>
              <ControlRow>
                <Label>Benchmark Switch State Query Speed</Label>
                <Detail>
                  <AccentButton
                    onClick={async () => {
                      const start = performance.now();
                      await Array(1000)
                        .fill(0)
                        .map((_) =>
                          api.getKeyboardValue(
                            KeyboardValue.SWITCH_MATRIX_STATE,
                            20,
                          ),
                        );
                      console.info(
                        '1000 commands in ',
                        performance.now() - start,
                        'ms',
                      );
                    }}
                  >
                    Benchmark
                  </AccentButton>
                </Detail>
              </ControlRow>
            </ControlGroup>
          )}
          <ControlGroup>
            <ControlGroupHeader>Device IDs</ControlGroupHeader>
            <ControlRow>
              <Label>Connected Devices</Label>
              <Detail>{Object.values(connectedDevices).length} Devices</Detail>
            </ControlRow>
            {Object.values(connectedDevices).map((device) => (
              <IndentedControlRow key={device.device.path}>
                <SubLabel>
                  {
                    (
                      (
                        allDefinitions.find(
                          ([id]) => id === device.vendorProductId.toString(),
                        ) as KeyboardDefinitionEntry
                      )[1] as VIADefinitionV2 | VIADefinitionV3
                    ).name
                  }
                </SubLabel>
                <Detail>
                  0x{device.vendorProductId.toString(16).toUpperCase()}
                </Detail>
              </IndentedControlRow>
            ))}
            <ControlRow>
              <Label>Local definitions</Label>
              <Detail>
                {Object.values(localDefinitions).length} Definitions
              </Detail>
            </ControlRow>
            {Object.values(localDefinitions).map(([id, definition]) => (
              <IndentedControlRow key={id}>
                <SubLabel>{definition.name}</SubLabel>
                <Detail>
                  0x
                  {parseInt(id).toString(16).toUpperCase()}
                </Detail>
              </IndentedControlRow>
            ))}
            <ControlRow>
              <details>
                <summary>
                  <Label>Remote definitions</Label>
                  <Detail>
                    {Object.values(remoteDefinitions).length} Definitions
                  </Detail>
                </summary>
                {Object.values(remoteDefinitions).map(([id, definition]) => (
                  <IndentedControlRow>
                    <SubLabel>{definition.name}</SubLabel>
                    <Detail>
                      0x
                      {parseInt(id).toString(16).toUpperCase()}
                    </Detail>
                  </IndentedControlRow>
                ))}
              </details>
            </ControlRow>
          </ControlGroup>
          <TestControls />
        </Container>
      </MenuPanel>
    </DebugPane>
  );
};
